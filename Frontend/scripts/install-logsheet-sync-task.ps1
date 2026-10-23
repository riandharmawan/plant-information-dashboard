# Registers one daily Windows task that runs every logsheet pull, one after another.
# Each form still writes its own sync report. The combined summary is Docs/exports/logsheet-sync/sync-report.txt.
# Credentials stay in Frontend/.env.sync. The task itself does not store the password.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'sync-all.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$at = if ($args.Count -gt 0) { $args[0] } else { '16:00' }

$replaced = @(
  'Plant Dashboard utility sync',
  'Plant Dashboard RFA-004A sync',
  'Plant Dashboard TNF-004 sync',
  'Plant Dashboard RFA-004B sync',
  'Plant Dashboard sounding sync',
  'Plant Dashboard refinery quality sync',
  'Plant Dashboard analytical sync'
)
foreach ($name in $replaced) {
  $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if (-not $existing) { continue }
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Output "Unregistered '$name'"
}

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $frontend
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 8)
Register-ScheduledTask `
  -TaskName 'Plant Dashboard logsheet sync' `
  -Description 'Download every logsheet form through today, one after another, and write a combined sync report.' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Output "Registered 'Plant Dashboard logsheet sync' daily at $at"
Write-Output "Node: $node"
Write-Output "Script: $script"
