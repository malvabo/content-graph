# Claude Code — project guidance

## Deployment

**Always ship finished work to `main`.** This project deploys to
`content-graph-five.vercel.app` from `main`, so any work that isn't
merged to `main` is invisible in production. Pattern:

1. Develop on a feature branch (`claude/<slug>`).
2. When the change is ready, open a PR to `main` and merge it
   (squash preferred).
3. Confirm Vercel auto-deploys (production URL picks up the commit
   within ~1–2 min).

Leaving work on a feature branch without merging is the wrong
default here — the user's testing environment is the live URL, not
a local dev server.

### Branch-to-branch handoffs

If `main` has evolved significantly while a feature branch was open,
don't blindly merge. Read `git log origin/main..HEAD` and check
whether parts of the feature branch have been superseded by work
already on `main`. Port only what's still needed, cleanly, to a
fresh branch off `origin/main`. Close the stale branch's PR with a
short reason.
