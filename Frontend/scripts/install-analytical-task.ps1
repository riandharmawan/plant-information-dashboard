# Registers a daily Windows task that downloads F/QCO-001 and refreshes the dashboard.
# Credentials stay in Frontend/.env.sync. The task itself does not store the password.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'sync-analytical.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$at = if ($args.Count -gt 0) { $args[0] } else { '16:10' }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $frontend
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd
Register-ScheduledTask `
  -TaskName 'Plant Dashboard analytical sync' `
  -Description 'Download Daily Storage Tank Analytical Result F/QCO-001 for days that have an analysis, then refresh the dashboard data.' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Output "Registered 'Plant Dashboard analytical sync' daily at $at"
Write-Output "Node: $node"
Write-Output "Script: $script"
