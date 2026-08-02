import logger from "../../utils/logger.js";

/**
 * The tool catalogue.
 *
 * Tools are declarative objects rather than bare functions, because the
 * metadata is what makes everything else possible: `toolAuth` can refuse a call
 * before dispatch, evals can score tool selection per name, the trace can
 * record what was attempted, and the model can be shown only the tools valid
 * for the turn it is on.
 *
 * A description string is prompt surface. Version it with the prompts, eval
 * changes to it, and never let it be user-editable.
 */
const tools = new Map();

/** Anything with a side effect the user would notice if it happened by mistake. */
export const MUTATING = new Set(["write", "destructive", "external"]);

/**
 * What a tainted run loses.
 *
 * Not everything mutating, and the distinction is deliberate. Every music tool
 * returns track and artist names, which are third-party text — so a rule that
 * removed all mutating tools on taint would mean the assistant could never play
 * a song, ever. The feature and the control would be mutually exclusive.
 *
 * The taint rule exists because a run that has read someone else's text may be
 * following someone else's instructions. There are two mitigations: remove the
 * capability, or put a human in front of it. For an irreversible action, remove
 * it — people rubber-stamp confirmations. For a reversible one whose summary
 * names the exact thing that will happen, review is adequate.
 *
 * So `write` and `destructive` are withdrawn outright on a tainted run, and
 * `external` may still be proposed. The worst an injected track name can then
 * achieve is a confirmation dialogue offering to play a song the user did not
 * ask for, which they can decline, and which stops when they stop it.
 */
export const BLOCKED_WHEN_TAINTED = new Set(["write", "destructive"]);

export const registerTool = (definition) => {
  const required = ["name", "description", "sideEffect", "ownership", "handler"];
  for (const field of required) {
    if (!definition[field]) throw new Error(`Tool is missing ${field}`);
  }

  if (tools.has(definition.name)) {
    throw new Error(`Tool ${definition.name} is already registered`);
  }

  tools.set(definition.name, {
    requiresConfirmation: MUTATING.has(definition.sideEffect),
    timeoutMs: 3000,
    scopes: [],
    idempotent: true,
    ...definition,
  });

  return definition.name;
};

export const getTool = (name) => tools.get(name);
export const listTools = () => [...tools.values()];
export const clearTools = () => tools.clear();

/**
 * The tools a given run may see.
 *
 * A tainted run — one that has read text a third party wrote — loses everything
 * that changes state. It is the cheapest strong control against an injection
 * arriving through a collaborator's playlist name and being obeyed.
 */
export const availableTools = ({ tainted = false } = {}) =>
  listTools().filter((tool) => !(tainted && BLOCKED_WHEN_TAINTED.has(tool.sideEffect)));

/** The model-facing schema list, which is all the model ever sees. */
export const describeTools = (options) =>
  availableTools(options).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
  }));

/**
 * Runs a tool with its own timeout.
 *
 * A slow external call inside an agent loop is how a turn becomes a
 * thirty-second response, so every tool declares a deadline and the loop
 * enforces it rather than trusting the tool to.
 */
export const dispatch = async (tool, input, ctx) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${tool.name} timed out after ${tool.timeoutMs}ms`)),
      tool.timeoutMs
    );
  });

  try {
    return await Promise.race([tool.handler(input, ctx), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

export const validateInput = (tool, input = {}) => {
  const schema = tool.inputSchema;
  if (!schema?.properties) return { valid: true, value: input };

  // `userId` is never a parameter — identity comes from the session. A model
  // that invents one is trying to act as somebody else, so this is a hard
  // rejection rather than a silent strip.
  if ("userId" in input) {
    return { valid: false, error: "userId is not an accepted parameter" };
  }

  for (const name of schema.required ?? []) {
    if (input[name] === undefined || input[name] === null) {
      return { valid: false, error: `${name} is required` };
    }
  }

  const value = {};
  for (const [name, spec] of Object.entries(schema.properties)) {
    const given = input[name];
    if (given === undefined || given === null) {
      if (spec.default !== undefined) value[name] = spec.default;
      continue;
    }

    if (spec.type === "integer" || spec.type === "number") {
      const parsed = Number(given);
      if (!Number.isFinite(parsed)) {
        return { valid: false, error: `${name} must be a number` };
      }
      if (spec.minimum !== undefined && parsed < spec.minimum) {
        return { valid: false, error: `${name} must be at least ${spec.minimum}` };
      }
      if (spec.maximum !== undefined && parsed > spec.maximum) {
        return { valid: false, error: `${name} must be at most ${spec.maximum}` };
      }
      value[name] = spec.type === "integer" ? Math.round(parsed) : parsed;
      continue;
    }

    if (spec.type === "array") {
      if (!Array.isArray(given)) return { valid: false, error: `${name} must be a list` };
      if (spec.maxItems && given.length > spec.maxItems) {
        return { valid: false, error: `${name} may hold at most ${spec.maxItems} items` };
      }
      value[name] = given.slice(0, spec.maxItems ?? 50);
      continue;
    }

    if (spec.type === "string") {
      if (typeof given !== "string") {
        return { valid: false, error: `${name} must be a string` };
      }
      if (spec.enum && !spec.enum.includes(given)) {
        return { valid: false, error: `${name} must be one of ${spec.enum.join(", ")}` };
      }
      value[name] = given.slice(0, spec.maxLength ?? 500);
      continue;
    }

    value[name] = given;
  }

  // Unknown keys are dropped rather than passed through, so a handler can never
  // receive something the schema did not describe.
  const dropped = Object.keys(input).filter((key) => !(key in schema.properties));
  if (dropped.length > 0) {
    logger.debug("dropped unknown tool arguments", { tool: tool.name, dropped });
  }

  return { valid: true, value };
};
