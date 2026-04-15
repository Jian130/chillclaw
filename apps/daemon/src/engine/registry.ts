import type { EngineAdapter } from "./adapter.js";
import { MockAdapter } from "./mock-adapter.js";
import { OpenClawAdapter } from "./openclaw-adapter.js";
import type { RuntimeManager } from "../runtime-manager/runtime-manager.js";

export function createEngineAdapter(options?: { runtimeManager?: RuntimeManager }): EngineAdapter {
  const selected = process.env.CHILLCLAW_ENGINE ?? "openclaw";

  if (selected === "mock") {
    return new MockAdapter();
  }

  return new OpenClawAdapter(undefined, options?.runtimeManager);
}
