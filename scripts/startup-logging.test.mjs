import assert from "node:assert/strict";
import test from "node:test";

import {
  STARTUP_LOAD_STEPS,
  formatStartupDoneMessage,
  logStartupChecklist
} from "./startup-logging.mjs";

test("startup checklist exposes the full 61-step loading path", () => {
  assert.equal(STARTUP_LOAD_STEPS.length, 61);
  assert.equal(STARTUP_LOAD_STEPS[0], "Run the root npm start script.");
  assert.equal(STARTUP_LOAD_STEPS.at(-1), "Print daemon and UI URLs for the ready dev environment.");
});

test("startup checklist logs every loading step with stable numbering", () => {
  const lines = [];

  logStartupChecklist((message) => {
    lines.push(message);
  });

  assert.equal(lines[0], "Startup loading checklist: 61 observable steps.");
  assert.equal(lines.length, 62);
  assert.equal(lines[1], "Startup checklist 01/61: Run the root npm start script.");
  assert.equal(lines.at(-1), "Startup checklist 61/61: Print daemon and UI URLs for the ready dev environment.");
});

test("startup done message is explicit and includes duration plus URLs", () => {
  const message = formatStartupDoneMessage({
    durationMs: 1234.56,
    daemonUrl: "http://127.0.0.1:4545",
    uiUrl: "http://127.0.0.1:4173"
  });

  assert.equal(
    message,
    "DONE. ChillClaw loading process done in 1235ms. Daemon: http://127.0.0.1:4545 UI: http://127.0.0.1:4173"
  );
});
