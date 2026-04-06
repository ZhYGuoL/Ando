# Branch: `demo/quick-demo`

**Goal:** Ship a convincing demo fast — orchestration stays in the client; no persistence required.

## Scope

- Keep **Zustand + seed** as source of truth; add **scripted actions** (buttons, dev shortcuts) that mutate messages/agents/permission state.
- Deploy **static** (Vercel / Netlify / Cloudflare Pages). No server required for the happy path.
- Optional: **one serverless function** + model API if you need a single “real” agent reply; still no DB.

## Do / don’t

- **Do:** One polished path (e.g. assign → permission → approve → completion → mission control).
- **Do:** Recorded walkthrough or staged data for investor/design reviews.
- **Don’t:** Supabase, auth, or multi-tenant polish on this branch unless the demo explicitly needs it.

## Merge strategy

When the narrative is stable, merge **UI fixes only** into `main` or into `product/platform` via cherry-pick; avoid merging heavy product infra back into this branch.
