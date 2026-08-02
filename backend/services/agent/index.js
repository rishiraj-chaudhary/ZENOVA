import { registerReadTools } from "./tools/readTools.js";
import { registerWriteTools } from "./tools/writeTools.js";
import { clearTools, listTools } from "./toolRegistry.js";

export { runAgent } from "./orchestrator.js";

/**
 * Registers the tool catalogue once at startup.
 *
 * Idempotent, because the test helper builds the app more than once per process
 * and re-registering a tool is an error by design — a duplicate name would make
 * dispatch ambiguous.
 */
export const initializeAgent = () => {
  if (listTools().length > 0) return listTools().length;

  registerReadTools();
  registerWriteTools();
  return listTools().length;
};

export { clearTools, listTools };
