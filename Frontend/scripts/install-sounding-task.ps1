# Registers a daily Windows task that downloads F-TNF-003 and writes it to the database.
# Each run also writes Docs/exports/storage-tank-sounding/sync-report.txt and appends sync.log.
# Credentials stay in Frontend/.env.sync. The task itself does not store the password.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'sync-sounding.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$at = if ($args.Count -gt 0) { $args[0] } else { '16:00' }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $frontend
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask `
  -TaskName 'Plant Dashboard sounding sync' `
  -Description 'Download Storage Tank Sounding F-TNF-003 through today, insert it into the database, and write sync-report.txt.' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Output "Registered 'Plant Dashboard sounding sync' daily at $at"
Write-Output "Node: $node"
Write-Output "Script: $script"
