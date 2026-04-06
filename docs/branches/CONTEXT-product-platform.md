# Context: `product/platform`

## If you are the “product” agent

You own the **`product/platform`** branch and the **`Ando-product`** worktree. Your goal is a **v1-shaped product**: state **survives refresh**, API boundaries are real, and secrets never ship in the browser.

## What exists today (shared baseline)

Same UI and Zustand shapes as [CONTEXT-main.md](./CONTEXT-main.md). The client already models:

- **`FeedMessage`** / **`StoreAgent`** / **`permissionCardStates`** — treat these as your **DTO targets** for APIs and persistence.
- **Selectors** — e.g. `selectMissionControlActivityFeed`, `selectCockpitTaskHistoryMerged`, `selectLastHumanInteractionLabel` — keep server data consistent enough that selectors keep working without forking the app into “two truths.”

## What you should focus on

1. **Persistence** — Introduce a backend store (e.g. **Supabase** or Firebase) for workspaces, channels, messages, permission card state, and optionally agent snapshots. Map rows ↔ existing types in `src/store/index.ts`.
2. **BFF / serverless** — API keys for LLM providers live **only** on the server. Thin routes: `POST` message/agent step, `PATCH` approval, etc. Client calls **your** origin, not OpenAI/Anthropic directly from the bundle.
3. **Load and hydration** — Replace or augment initial `create()` seed with `fetch`/subscription that fills `messages` and `agents`; keep **optimistic updates** and error states in mind for approvals.
4. **Auth (minimal v1)** — Workspace-scoped identity (magic link, OAuth, or SSO-lite) so URLs and data are not global-demo fiction.
5. **Idempotency and audit** — Approve/deny should be safe to retry; log **who** approved **what** for mission control trust.

## What to avoid on this branch

- **Long-lived divergence** from `main` on shared components without merging — rebase/merge `main` regularly.
- Rewriting **brand/layout contracts** in `brand.md` without explicit approval (demo line may depend on them).
- Blocking on hyperscaler “agent platforms” (Bedrock agents, full RAG) until **one channel** is end-to-end with your BFF + DB.

## Sync expectations

- **Merge `main`** often for UI fixes; **cherry-pick** from `demo/quick-demo` only when changes are not demo-hacky.
- **Push** to `origin product/platform`.
- **Migrations and env** — document in-repo (e.g. `docs/` or `.env.example`); never commit secrets.

## Related

- [CONTEXT-main.md](./CONTEXT-main.md)  
- [CONTEXT-demo-quick-demo.md](./CONTEXT-demo-quick-demo.md)  
- `docs/02-memory-persistence.md`, `docs/03-messaging-queues-and-channel-patterns.md` — data model hints  
