# Context: `demo/quick-demo`

## If you are the “demo” agent

You own the **`demo/quick-demo`** branch and the **`Ando-demo`** worktree (sibling folder to `Ando`, same remote branches). Your goal is a **credible, fast-to-ship demo**: narrative clarity beats production completeness.

## What exists today (shared baseline)

Everything described in [CONTEXT-main.md](./CONTEXT-main.md) is already in your tree once you merge `main` — full **four-screen UI**, **Zustand** models, **seeded** multi-channel story:

- **#frontend** — Patch, settings / lazy-bundle permission, subprocess trace, approve → completion path in store actions.
- **#infra** — Scout (`backend`), blocked with a **real pending permission** card (`msg-i-003`) so mission control and feed stay consistent.
- **#release-train** — light thread for Mux so **last human interaction** is feed-derived.

**Do not** reintroduce a second “legacy” agents array in `App.tsx`; identity and status come from **`store.agents`**.

## What you should focus on

1. **One golden path** — Assign → agent reply → permission → approve (or deny) → completion / mission control updates — feels obvious in under two minutes.
2. **Scripted or in-app “demo controls”** — Dev-only or subtle controls that advance the store (new messages, toggle states) **without** requiring a backend.
3. **Static deploy** — App should run from `npm run build` + static host (Vercel/Netlify/Cloudflare Pages) with **no secrets** in the client beyond public demo config if any.
4. **Optional single LLM call** — One serverless endpoint is acceptable on this line **if** it stays optional and does not block the static demo; avoid pulling in full DB stack here.

## What to avoid on this branch

- **Supabase / Postgres / multi-tenant auth** as a prerequisite for the demo (that belongs on `product/platform`).
- Large “product-only” migrations that make merging back to `main` painful.
- Duplicating business logic that already lives in **`src/store`** — extend the store and selectors instead.

## Sync expectations

- **Merge `main` in** when the integration branch gets bugfixes or doc updates you need.
- **Push** to `origin demo/quick-demo`; use **`--force-with-lease`** only if you intentionally rewrote history.
- When UX changes are stable and product-agnostic, **open a PR or merge to `main`** so `product/platform` can absorb them.

## Related

- [CONTEXT-main.md](./CONTEXT-main.md)  
- [CONTEXT-product-platform.md](./CONTEXT-product-platform.md)  
