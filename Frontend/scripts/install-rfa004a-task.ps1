# Registers a daily Windows task that downloads F/RFA-004(A) and inserts production days.
# Each run also writes Docs/exports/refinery-daily-log/sync-report.txt and appends sync.log.
# Credentials stay in Frontend/.env.sync. The task itself does not store the password.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'sync-rfa004a.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$at = if ($args.Count -gt 0) { $args[0] } else { '16:00' }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $frontend
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask `
  -TaskName 'Plant Dashboard RFA-004A sync' `
  -Description 'Download Refinery daily log F/RFA-004(A) through today, insert production days, and write sync-report.txt.' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Output "Registered 'Plant Dashboard RFA-004A sync' daily at $at"
Write-Output "Node: $node"
Write-Output "Script: $script"
