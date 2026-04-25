# Claude Code — project guidance

## Default behavior — ship every change

**For every user request that produces a code change, the default flow is:
commit → push → PR → squash-merge to `main`.** No "I'll leave it on the
branch" — production is `content-graph-five.vercel.app` deploying from
`main`, and the user's testing environment is that live URL. Anything
not on `main` is invisible to them. Confirm reaches main before
declaring the task done.

The only exception: `.claude/` config files. Those are still committed
to `main` (so they travel with the repo) but Vercel does not deploy
them, so they will not change anything visible on the live URL.

## Git workflow

**Always push after every commit.** Use `git push -u origin <branch>` immediately after committing so changes are visible on the remote.

**Always open a PR to `main` when work is complete.** After pushing, open a PR so changes can be reviewed and deployed to production.

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
