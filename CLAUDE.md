# Claude Code — project guidance

## Default behavior — commit straight to main

**For every user request that produces a code change, the default flow is:
commit on `main` → push to `origin/main`.** No feature branch, no PR,
no squash-merge ceremony. Single-developer project; the PR overhead
isn't earning anything.

Production is `content-graph-five.vercel.app` deploying from `main`,
and the user's testing environment is the live URL. So pushing to
`main` *is* shipping.

`.claude/` config files are still committed (so they travel with the
repo) but Vercel does not deploy them, so they will not change
anything visible on the live URL.

## Git workflow

1. Stay on `main` (`git checkout main` if not already).
2. Make the edit.
3. Commit with a clear, descriptive message.
4. `git push origin main` immediately so the change is on the remote.

If `main` has diverged from `origin/main` (sandboxed checkpoints,
auto-applied changes, etc.), reset cleanly with
`git reset --hard origin/main` *before* starting the edit. Don't try
to reconcile drift mid-task.

### When to use a branch + PR anyway

Only when:
- The user explicitly asks for a PR.
- The change is risky or needs review (large refactor, schema
  migration, dependency upgrade).
- A team member needs to be tagged.

Otherwise, default is direct push.

### When the sandbox blocks direct push to `main`

Some Claude Code sessions run with a proxy that 403s `git push origin
main` and forces work onto an assigned feature branch. When that
happens, the goal — *change visible on `main`* — is unchanged. Do this
without asking:

1. Move the commit onto the assigned feature branch and push it there.
2. Open a PR (draft is fine — the harness wants one anyway).
3. Immediately mark it ready and merge it into `main` via the GitHub
   MCP (`mcp__github__merge_pull_request`, `merge_method: squash`).
4. Confirm `origin/main` advanced (`git fetch origin main`,
   `git log --oneline origin/main -1`) and tell the user it's on
   `main` and `git pull` will bring it down.

Do not leave a draft PR sitting open and stop there — the user only
pulls `main`, so a PR that hasn't been merged is invisible to them and
counts as "no change shipped." The proxy blocks the push, not the
merge, so the merge path is the workaround.
