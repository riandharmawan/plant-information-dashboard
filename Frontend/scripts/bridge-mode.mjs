// A bridge PC has no local database. It downloads logsheet days and sends them
// straight to staging. Set BRIDGE_MODE=1 (the sync-and-push-bridge.mjs wrapper
// does this) to skip every local database write and read in the sync-*.mjs jobs.
// The payload queued for staging is unchanged either way.
export function bridgeMode() {
  return process.env.BRIDGE_MODE === '1'
}
