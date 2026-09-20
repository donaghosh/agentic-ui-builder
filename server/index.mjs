import express from "express";
import cors from "cors";
import { runAgentTurn } from "./agent.mjs";
import { raisePullRequest } from "./git.mjs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Streams newline-delimited JSON events: {type:"text"|"tool"|"error", text}
app.post("/api/chat", async (req, res) => {
  const message = (req.body?.message || "").toString().trim();
  if (!message) return res.status(400).json({ error: "message is required" });

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");

  const write = (evt) => res.write(JSON.stringify(evt) + "\n");
  try {
    await runAgentTurn(message, write);
  } catch (err) {
    write({ type: "error", text: err?.message || String(err) });
  }
  res.end();
});

app.post("/api/pr", async (req, res) => {
  const title = (req.body?.title || "").toString().trim() || "UI changes";
  try {
    const result = await raisePullRequest(title);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "[api] ANTHROPIC_API_KEY not set — the agent will fall back to your logged-in Claude Code auth if available."
    );
  }
});
