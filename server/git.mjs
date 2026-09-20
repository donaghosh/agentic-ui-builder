import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const git = (args) => exec("git", args, { cwd: REPO_ROOT });

async function currentBranch() {
  const { stdout } = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

/**
 * Carries the current working-tree changes (the generated UI) onto a fresh
 * branch, commits, pushes, and opens a PR against the base branch using the
 * authenticated `gh` CLI. Returns { url, branch }.
 *
 * Assumes the base branch already exists on origin (the builder scaffold is
 * committed to main during setup).
 */
export async function raisePullRequest(title) {
  const { stdout: status } = await git(["status", "--porcelain"]);
  if (!status.trim()) throw new Error("No changes to commit yet.");

  const base = await currentBranch();
  const branch = `ui/${Date.now()}`;

  // Creating a branch carries the uncommitted changes with it, leaving base clean.
  await git(["checkout", "-b", branch]);
  await git(["add", "-A"]);
  await git(["commit", "-m", title]);
  await git(["push", "-u", "origin", branch]);

  const { stdout: url } = await exec(
    "gh",
    [
      "pr",
      "create",
      "--title",
      title,
      "--body",
      "UI changes generated via the Agentic UI Builder.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)",
      "--base",
      base,
      "--head",
      branch,
    ],
    { cwd: REPO_ROOT }
  );

  // Return to the base branch so the next round of edits builds on it.
  await git(["checkout", base]);

  return { url: url.trim(), branch };
}
