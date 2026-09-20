import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BASE_BRANCH = process.env.BASE_BRANCH || "main";
const WORK_PREFIX = "ui/";

const git = (args) => exec("git", args, { cwd: REPO_ROOT });

async function currentBranch() {
  const { stdout } = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
}

async function hasWorkingChanges() {
  const { stdout } = await git(["status", "--porcelain"]);
  return stdout.trim().length > 0;
}

// Returns the URL of the open PR for `branch`, or null if none exists yet.
async function existingPrUrl(branch) {
  try {
    const { stdout } = await exec(
      "gh",
      ["pr", "view", branch, "--json", "url,state", "-q", "{url: .url, state: .state}"],
      { cwd: REPO_ROOT }
    );
    const info = JSON.parse(stdout);
    return info.state === "OPEN" ? info.url : null;
  } catch {
    return null; // no PR for this branch
  }
}

/**
 * Stacking model: all edits accumulate on ONE working branch and update ONE
 * open PR. Each call commits the current working-tree changes, pushes, and
 * ensures the PR exists — reusing the same PR on subsequent calls.
 *
 * - If we're on the base branch, a fresh `ui/<ts>` branch is created (carrying
 *   the uncommitted changes) and we stay on it for future edits.
 * - If we're already on a `ui/*` branch, we commit onto it, updating its PR.
 *
 * Returns { url, branch, created }.
 */
export async function raisePullRequest(title) {
  let branch = await currentBranch();
  const onWorkBranch = branch.startsWith(WORK_PREFIX);

  if (!onWorkBranch) {
    if (!(await hasWorkingChanges())) throw new Error("No changes to commit yet.");
    branch = `${WORK_PREFIX}${Date.now()}`;
    // Creating the branch carries the uncommitted changes onto it.
    await git(["checkout", "-b", branch]);
  }

  // Commit whatever is currently uncommitted (may be nothing on a repeat click).
  if (await hasWorkingChanges()) {
    await git(["add", "-A"]);
    await git(["commit", "-m", title]);
  }

  await git(["push", "-u", "origin", branch]);

  // Reuse the branch's open PR if it has one; otherwise open a new one.
  let url = await existingPrUrl(branch);
  let created = false;
  if (!url) {
    const { stdout } = await exec(
      "gh",
      [
        "pr",
        "create",
        "--title",
        title,
        "--body",
        "UI changes generated via the Agentic UI Builder.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)",
        "--base",
        BASE_BRANCH,
        "--head",
        branch,
      ],
      { cwd: REPO_ROOT }
    );
    url = stdout.trim();
    created = true;
  }

  // Intentionally STAY on the work branch so the next round of edits stacks
  // onto the same PR.
  return { url, branch, created };
}
