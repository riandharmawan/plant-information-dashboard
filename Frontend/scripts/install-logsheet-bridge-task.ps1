# Registers a daily Windows task for a bridge-only PC: one with no local database.
# It downloads new logsheet days and sends them straight to staging. Staging does
# the database write.
#
# This is a separate task from 'Plant Dashboard logsheet sync' (install-logsheet-sync-task.ps1).
# It does not touch, rename, or unregister that task. Run this script only on a PC
# that is not also running the local-database task.
#
# Each form still writes its own sync report. The combined summary is Docs/exports/logsheet-sync/sync-report.txt.
# The send summary is Docs/exports/staging-outbox/push-report.txt.
# Logsheet credentials stay in Frontend/.env.sync. Staging SSH settings stay in Frontend/.env.staging-push.
# The task itself does not store the password.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent $PSScriptRoot
$script = Join-Path $PSScriptRoot 'sync-and-push-bridge.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
$at = if ($args.Count -gt 0) { $args[0] } else { '16:00' }

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$script`"" -WorkingDirectory $frontend
$trigger = New-ScheduledTaskTrigger -Daily -At $at
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopOnIdleEnd `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 8)
Register-ScheduledTask `
  -TaskName 'Plant Dashboard logsheet bridge sync' `
  -Description 'Download every logsheet form through today and send the new days to staging. No local database on this PC.' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Force | Out-Null

Write-Output "Registered 'Plant Dashboard logsheet bridge sync' daily at $at"
Write-Output "Node: $node"
Write-Output "Script: $script"
