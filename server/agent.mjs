import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const GEN_DIR = path.join(REPO_ROOT, "src", "generated");

const SYSTEM_PROMPT = `You are a UI-building agent embedded in a live app builder used by non-technical people.

Your job: translate the user's plain-English request into a working React UI.

Hard rules:
- You are building a single React app whose ROOT component is the default export of ./App.tsx (in your current working directory, which is src/generated).
- Only create or edit files inside this directory (App.tsx and any component files you import from it). Never touch files elsewhere.
- Use React 18 function components and Tailwind CSS utility classes for ALL styling. Do NOT import any CSS files and do NOT add new npm dependencies — only "react" is available.
- App.tsx MUST always have a valid default export that renders without runtime errors, so the live preview never breaks.
- Make incremental edits: read the current App.tsx first, then modify it to satisfy the new request while preserving prior work unless the user asks to replace it.
- Keep code clean and self-contained. Prefer editing App.tsx directly; only split into separate files when a component is large or reused.
- After editing, give the user a one or two sentence plain-English summary of what changed. No code in your final reply.`;

/**
 * Runs one agent turn. Calls onEvent({type, text}) for streaming UI updates.
 * type is one of: "text" | "tool" | "error".
 */
// Persists the conversation for the life of the server process, so each turn
// remembers prior messages (not just the code on disk). Resets on restart.
let sessionId = null;

export function resetConversation() {
  sessionId = null;
}

export async function runAgentTurn(message, onEvent) {
  try {
    for await (const m of query({
      prompt: message,
      options: {
        cwd: GEN_DIR,
        systemPrompt: SYSTEM_PROMPT,
        permissionMode: "bypassPermissions",
        allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
        disallowedTools: ["Bash", "WebFetch", "WebSearch"],
        model: process.env.AGENT_MODEL || "claude-sonnet-5",
        maxTurns: 20,
        // Resume the same conversation on every turn after the first.
        ...(sessionId ? { resume: sessionId } : {}),
      },
    })) {
      // The SDK stamps session_id on its messages (system init + result).
      // Capture it so the next turn resumes this same conversation.
      if (m?.session_id) sessionId = m.session_id;
      normalize(m, onEvent);
    }
  } catch (err) {
    onEvent({ type: "error", text: err?.message || String(err) });
  }
}

// The SDK yields stream-json messages. Normalize the shapes we care about.
function normalize(m, onEvent) {
  if (!m || typeof m !== "object") return;

  if (m.type === "assistant" && m.message?.content) {
    for (const block of m.message.content) {
      if (block.type === "text" && block.text) {
        onEvent({ type: "text", text: block.text });
      } else if (block.type === "tool_use") {
        onEvent({ type: "tool", text: describeTool(block.name, block.input) });
      }
    }
    return;
  }

  if (m.type === "result") {
    if (m.subtype && m.subtype !== "success") {
      onEvent({
        type: "error",
        text:
          m.result ||
          `Agent stopped: ${m.subtype}` +
            (m.subtype === "error_max_turns" ? " (hit turn limit)" : ""),
      });
    }
    return;
  }

  // Some SDK builds emit simplified events; support them too.
  if (m.type === "assistant_text" && m.text) {
    onEvent({ type: "text", text: m.text });
  } else if (m.type === "tool_use") {
    onEvent({ type: "tool", text: describeTool(m.name, m.input) });
  }
}

function describeTool(name, input = {}) {
  const file = input.file_path || input.path || input.pattern || "";
  const short = file ? path.basename(String(file)) : "";
  switch (name) {
    case "Write":
      return `Writing ${short}`;
    case "Edit":
      return `Editing ${short}`;
    case "Read":
      return `Reading ${short}`;
    case "Glob":
    case "Grep":
      return `Searching (${short})`;
    default:
      return `${name} ${short}`.trim();
  }
}
