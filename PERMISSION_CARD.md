# Permission Card — Interaction Spec

> Read this file in full before writing any code.
> Also read: PRODUCT.md, 03-messaging-queues-and-channel-patterns.md

---

## Context

When an agent needs to take a sensitive action — writing to a core file, calling an external API, deleting data — it surfaces a permission request inline in the channel feed. Any team member can approve or deny it, with a full audit trail recorded permanently in the feed. The agent continues other work while waiting — it is never fully blocked.

This component lives inside a feed message, beneath the agent's message text. It is not a modal, not a toast, not a separate page. It appears, resolves, and stays in the feed as a record.

---

## States

The card moves through the following states. Accept a `state` prop to switch between them.

- `pending`
- `reviewing`
- `approved`
- `denied`
- `always-allowed-confirming`
- `always-allowed-resolved`
- `cancelled`

---

## State details and transitions

### `pending`

The default state when the request arrives in the feed.

Shows:
- What action the agent wants to take
- What resource is affected
- A plain-language description of why it matters
- Three actions: `Approve`, `Deny`, `Always allow this pattern →`
- Below the card, outside it: a line indicating the agent is continuing other work while waiting

Transitions:
- Any action clicked → `reviewing`

---

### `reviewing`

Triggered the moment any action button is clicked. The card locks immediately for all other users.

Shows:
- The name of the person who clicked and what they clicked: `Maya is reviewing...`
- No actions available — the card is fully locked
- The agent continuing line remains visible below

Transitions:
- They confirm Approve → `approved`
- They confirm Deny → `denied`
- They click Always allow and confirm → `always-allowed-resolved`
- They click Always allow but see the confirmation step first → `always-allowed-confirming`
- They abandon (navigate away, no action within timeout) → lock releases → back to `pending`

The lock exists to prevent two people acting simultaneously. First click wins. If the reviewer abandons, the card must return cleanly to `pending` so someone else can act.

---

### `approved`

The request was approved. The card resolves and permanently recedes.

Shows:
- Who approved and when — this is the audit record
- No actions

The card collapses to minimal height. It is done and should stop demanding attention. It stays in the feed permanently.

The agent picks up the blocked step and continues.

---

### `denied`

The request was denied. Same collapse behavior as approved.

Shows:
- Who denied and when — audit record
- No actions

The card collapses to minimal height and stays in the feed permanently.

Separately, the agent sends a new follow-up message in the feed explaining what it will do instead — skip the action, try an alternate approach, or ask the team for direction. That follow-up is a normal agent message, not part of this card.

---

### `always-allowed-confirming`

An intermediate step before the rule is set. Triggered when the reviewer clicks `Always allow this pattern →` from the `reviewing` state.

Shows:
- A single plain-language sentence describing exactly what rule is about to be created, scoped to this agent only:
  > `This will allow Frontend Agent to write to src/auth/** without asking.`
- Two inline actions: `Set rule` and `Cancel`
- The original description and affected resource remain visible so the reviewer can verify what they're allowing before committing

No modal. No form. One sentence, two actions, inline.

Transitions:
- `Set rule` → `always-allowed-resolved`
- `Cancel` → lock releases → back to `pending`

---

### `always-allowed-resolved`

The rule has been set and the request approved in one action.

Shows:
- Who approved and when — audit record
- A second line indicating a standing rule was created for this agent
- A tag or indicator showing the scope of the rule (what action, what resource, which agent)

This is visually distinct from a plain `approved` state. The rule indicator communicates that a policy was created, not just a one-time action taken.

The card collapses and stays in the feed permanently as both an approval record and a policy record.

The rule itself is also visible on the agent's profile page (Screen 2) under a Permissions section, where it can be revoked.

---

### `cancelled`

The agent was killed or stopped while the card was still pending or reviewing.

Shows:
- A line indicating the request is no longer active because the agent was stopped
- No actions

The card resolves to a neutral closed state. No approval or denial is recorded — the action never happened.

---

## Embedding in the feed

The card sits inside a feed message, beneath the agent's message text, aligned with the message body not the avatar. It flows directly beneath the text with no gap. The `Agent continuing other work` line sits outside and below the card, still within the message body.

```
[Avatar]  Agent Name  [tag]  timestamp
          Agent message text explaining what it wants to do
          and why it needs approval.

          ┌─ permission card ─────────────────────────────┐
          │                                               │
          └───────────────────────────────────────────────┘

          Agent is continuing other work while waiting.
```

Resolved states (approved, denied, always-allowed-resolved, cancelled) should occupy significantly less vertical space than the pending state. The card shrinks on resolution — it recedes into the feed rather than staying at full height.

---

## Simultaneous requests

If the same agent surfaces multiple permission requests before any are resolved, each appears as a separate card attached to separate agent messages. They are independent — each has its own state and is resolved individually. There is no batching.

---

## Animation

All state transitions should feel immediate and calm:
- Pending → Reviewing: buttons out, reviewer line in
- Reviewing → any resolved state: card collapses smoothly
- Always-allowed-confirming: confirmation sentence replaces buttons inline, no layout jump
- No bouncing, no sliding in from outside, no attention-seeking motion

---

## Dev/review page

Render all seven states on a single page, each embedded inside a mock feed message (avatar, name, timestamp, placeholder agent text above the card). Label each state above it. Do not render cards on a blank background — the feed embedding context must always be visible.

Order:
1. `pending`
2. `reviewing`
3. `approved`
4. `denied`
5. `always-allowed-confirming`
6. `always-allowed-resolved`
7. `cancelled`

Use hardcoded static content. The `state` prop is required.

### Optional copy for the real feed

In the workspace shell, pass optional **`actionTitle`**, **`resource`**, **`description`**, **`policyAgentName`**, and **`policyPathGlob`** so the card matches the thread narrative. Review-page defaults apply when these are omitted.
