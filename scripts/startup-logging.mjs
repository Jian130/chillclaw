export const STARTUP_LOAD_STEPS = Object.freeze([
  "Run the root npm start script.",
  "Enter the ChillClaw dev launcher.",
  "Resolve the repository root from the current working directory.",
  "Read the daemon port from CHILLCLAW_PORT or default to 4545.",
  "Read the UI port from CHILLCLAW_UI_PORT or default to 4173.",
  "Resolve the local Vite binary from node_modules.",
  "Build the dev runtime configuration from CHILLCLAW_DEV_RUNTIME.",
  "Select the managed local OpenClaw runtime when no external runtime is requested.",
  "Populate the managed runtime environment variables.",
  "Select the environment OpenClaw runtime when explicitly requested.",
  "Check local JavaScript dependencies.",
  "Check for orphaned ChillClaw dev processes on the daemon and UI ports.",
  "Recover orphaned repo-owned dev processes when they are found.",
  "Read the managed dev process state file.",
  "Abort startup if managed ChillClaw dev processes are already running.",
  "Build the shared contracts workspace.",
  "Build the daemon workspace.",
  "Decide whether the OpenClaw runtime needs managed preparation.",
  "Run the managed OpenClaw runtime preparation script.",
  "Create the runtime manager.",
  "Create the OpenClaw engine adapter.",
  "Install or detect the managed OpenClaw runtime through the adapter.",
  "Ensure the pinned managed OpenClaw runtime is available.",
  "Reuse an existing matching managed OpenClaw runtime when possible.",
  "Prepare the openclaw-runtime resource when the runtime is missing or mismatched.",
  "Prepare the node-npm-runtime dependency before OpenClaw.",
  "Probe the managed npm invocation.",
  "Install or copy the managed Node.js runtime when npm is missing.",
  "Verify the managed Node.js and npm binaries.",
  "Inspect the managed OpenClaw binary.",
  "Resolve the OpenClaw runtime install source.",
  "Verify the OpenClaw runtime artifact digest when one is provided.",
  "Install the managed OpenClaw runtime artifact.",
  "Back up the existing managed OpenClaw runtime while replacing it.",
  "Verify the managed OpenClaw CLI version.",
  "Resolve the OpenClaw config path.",
  "Normalize the OpenClaw gateway mode to local.",
  "Normalize the OpenClaw gateway bind to loopback.",
  "Normalize gateway auth to token mode and remove password or remote config.",
  "Ensure the OpenClaw agent timeout meets ChillClaw's baseline.",
  "Write adapter install state.",
  "Invalidate adapter read caches.",
  "Read engine status after runtime preparation.",
  "Check the daemon port is free.",
  "Check the UI port is free.",
  "Launch the daemon process.",
  "Write the daemon PID to dev process state.",
  "Wait for the daemon TCP port to accept connections.",
  "Install daemon console error handlers.",
  "Create the daemon HTTP server context.",
  "Create the daemon event bus and WebSocket bridge.",
  "Resume persisted download jobs.",
  "Resume pending local-model work.",
  "Stage approved runtime updates in the background.",
  "Install daemon API and static asset request handlers.",
  "Start listening on the daemon loopback port.",
  "Launch the Vite UI server.",
  "Write daemon and UI PIDs to dev process state.",
  "Wait for the UI TCP port to accept connections.",
  "Mark the ChillClaw dev environment ready.",
  "Print daemon and UI URLs for the ready dev environment."
]);

function padStep(index) {
  return String(index).padStart(2, "0");
}

export function logStartupChecklist(log) {
  log(`Startup loading checklist: ${STARTUP_LOAD_STEPS.length} observable steps.`);
  STARTUP_LOAD_STEPS.forEach((step, index) => {
    log(`Startup checklist ${padStep(index + 1)}/${STARTUP_LOAD_STEPS.length}: ${step}`);
  });
}

export function formatStartupDoneMessage({ durationMs, daemonUrl, uiUrl }) {
  return `DONE. ChillClaw loading process done in ${Math.round(durationMs)}ms. Daemon: ${daemonUrl} UI: ${uiUrl}`;
}
