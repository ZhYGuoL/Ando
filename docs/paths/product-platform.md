# Branch: `product/platform`

**Goal:** Same UI, but state **survives refresh**, links are shareable, and the stack looks like a v1 product.

## Scope

- **Persistence:** Supabase (or Firebase) for workspaces, channels, messages, permission state — map rows to existing `FeedMessage` / `StoreAgent` shapes.
- **LLM:** API keys only on the server — one **BFF** (Vercel/Cloudflare serverless or small Node service) for chat/agent steps; client calls your API, not OpenAI/Anthropic directly.
- **Realtime (later):** Supabase Realtime or SSE for feed updates; mission control stays derived from store + server events.

## Do / don’t

- **Do:** Auth boundary early (even magic link or SSO-lite) so “workspace” is real.
- **Do:** Idempotent approve/deny; audit who approved what.
- **Don’t:** Block on Bedrock/Temporal/full RAG until one channel is end-to-end.

## Merge strategy

Port **presentational** changes from `main` / `demo/quick-demo` freely; keep **migrations and secrets** only on this line until you promote them to production.
