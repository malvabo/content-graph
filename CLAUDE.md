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
