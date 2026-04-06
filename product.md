# Nave — Product Spec
> Read this file in full before writing any code. 
> Also read: brand.md, 01-orchestration-and-multi-agent.md, 
> 02-memory-persistence.md, 03-messaging-queues-and-channel-patterns.md,
> 04-long-running-agents-and-observability.md

# Cursor Prompt — Nave App UI/UX Shell

You are building the UI/UX shell of an Electron app called **Nave** — a Slack-like team workspace where persistent AI agents are first-class members alongside humans. This is a layout and design pass only — no real functionality, no API calls, no live data. Use static/hardcoded content to represent realistic states.

Before writing any code, read the following files in full and internalize them:
- `brand.md` — this is your design system. Every visual decision must trace back to it. IKB (`#002FA7`) is the primary brand color used sparingly. Near-monochrome base. No gradients, no shadows, max 6px border radius, flat surfaces only.
- `01-orchestration-and-multi-agent.md` — understand the agent/team model. Agents have persistent identity, roles, and presence states (running/idle/blocked).
- `02-memory-persistence.md` — understand memory scope (session vs team). Informs what metadata to surface in the UI.
- `03-messaging-queues-and-channel-patterns.md` — understand the priority model and message types. Some messages are human, some are agent reports, some are system-level permission requests.
- `04-long-running-agents-and-observability.md` — understand agent lifecycle. Agents spawn sub-processes, have partial results when killed, and report completion with structured metadata.

---

## What to build

Build the following screens as navigable pages in the Electron shell. Use React. Style with Tailwind utility classes only — no component libraries, no Chakra, no Material UI, no Radix. Every screen should feel like one coherent product.

---

### Screen 1 — Main workspace (primary view)

This is the core screen. A two-column layout: a narrow dark sidebar on the left, a main feed on the right.

**Sidebar** (`#0f0f0f` background, ~220px wide):
- Workspace name and member count at the top
- Two sections: **Channels** (hash-prefixed, standard list) and **Agents** (below a thin divider, visually heavier than channels)
- Each agent row shows: a colored square avatar with initials, agent name, and a live status pill — `running` (green), `blocked` (amber), `idle` (gray). A small status dot sits on the corner of the avatar.
- Agents are not bots appended to a channel list — they are a distinct entity type in the sidebar with their own section
- Current user at the bottom with initials avatar and online indicator

**Main feed** (right side, `#f5f4f0` background):
- Top bar: channel name, active agent name + current task as subtitle, sub-process count, two buttons — `View agent` and `+ Assign task` (IKB)
- A thin IKB notification banner just below the topbar showing a recent task completion with a `View diff →` link — this is the third completion signal
- The feed contains four visually distinct message types, all in the same chronological stream:

  1. **Human message** — simple, gray initials avatar, name, timestamp, plain text. Looks like Slack.
  2. **Agent message** — IKB square avatar, agent name rendered in IKB, small `agent` pill tag. Structurally the same as a human message but visually distinct.
  3. **Sub-process indicator** — appears inline attached beneath an agent message (not as a separate message). A thin labeled progress bar showing a named sub-process and its status. Clicking it should navigate to Screen 3 (agent cockpit). This is how humans see that background work is happening without it polluting the feed.
  4. **Permission card** — appears inline under the agent message that triggered the request. Amber left border or amber outline. Shows: what action needs approval, the affected file/resource in monospace, a plain-language description, three actions: `Approve`, `Deny`, `Always allow this pattern →`. The "always allow" option is important — teams build policy through repeated approvals, not config files.
  5. **Completion card** — the agent's final message on task completion. Green status dot, task name, duration, four stats (files changed, sub-processes, errors, approvals). Three actions: `View diff`, `View run log`, `Assign follow-up`.

- Input bar at the bottom: a single text field that accepts both human messages and `@agent` directives. Placeholder: `Message #channel or @agent...`

---

### Screen 2 — Agent profile / cockpit view

Accessed by clicking `View agent` in the topbar or clicking an agent in the sidebar. This is the agent's cockpit — not a settings page, more like a live status dashboard for that agent.

Show:
- Agent identity: name, avatar, role description, which channel it lives in, current status
- Current task: what it's working on right now, how long it's been running, how many sub-processes are active
- Sub-process list: each sub-process as a row with name, status, elapsed time, and a progress bar. These are the ephemeral workers spawned by the agent. Anyone on the team can see this by visiting this screen.
- Task history: a compact list of recently completed tasks — name, duration, outcome (completed/killed/failed), files changed
- Memory summary: a small section showing what the agent currently "knows" — recent decisions, open threads, constraints (derived from `02-memory-persistence.md`). This is read-only, not editable.
- A button to assign a new task, and a button to view full run logs

---

### Screen 3 — Sub-process detail view

Accessed by clicking a sub-process indicator in the feed or from the agent cockpit. This is the drill-down view for a single ephemeral sub-process.

Show:
- Parent agent name + link back to agent cockpit
- Sub-process name, type, status, elapsed time
- A live-ish log/transcript view: a scrollable list of steps the sub-process has taken — tool calls, file reads, decisions. Each step is a row with a type icon (read / write / analyze / spawn), a description, and a timestamp. This communicates what background work actually looks like without overwhelming the main feed.
- Partial result if the sub-process was killed — show what it had produced so far
- Status bar at the bottom: running / completed / killed / failed with appropriate color

---

### Screen 4 — Home / mission control

A top-level overview across the entire workspace. Think mission control — not for chatting, for awareness.

Show:
- All active agents as cards: name, status, current task, sub-process count, time running, last human interaction. Blocked agents should be visually emphasized (amber accent).
- A unified activity feed on the right: a single chronological stream of significant events across all channels — task completions, permission requests that need attention, agent state changes, new tasks assigned. This is where you go to see everything happening across the whole team at once.
- Pending permission requests surfaced prominently — these need human attention and should not be buried. Show them in a dedicated section or visually elevated in the activity feed.

---

## Key design decisions to follow

- Agents and humans coexist in the same feed but are never visually ambiguous. The distinction must be immediate — a human should never wonder if a message came from a person or an agent.
- Sub-processes are not surfaced in the main feed as messages. They are attached to the agent message that spawned them and discoverable via click. The feed stays readable.
- Permission requests are blocking UI — they appear inline and visually demand attention (amber) without being modal popups that interrupt the whole app.
- Task completion has three signals: (1) the completion card in the feed, (2) the IKB notification banner, (3) the agent's sidebar status changing to `idle`. All three should be present.
- The "Always allow this pattern" action on permission cards is not a throwaway button. It represents policy evolution — teams should be able to build up agent permissions over time through use, not upfront config. Design it accordingly.
- IKB (`#002FA7`) appears on: primary action buttons, agent names in the feed, agent avatars, the notification banner, active states, key metric numbers. Nowhere else.
- No modals. No popups. Everything surfaces inline or navigates to a new screen.
- Whitespace is structure. Do not fill space with decoration.
