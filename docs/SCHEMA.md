# Grokbot Visual Office data schema (v1)

The office renders one JSON document. Machine-readable version: [`schema/office.schema.json`](../schema/office.schema.json).
A complete fictional example: [`sample-data.json`](../sample-data.json).

```jsonc
{
  "schemaVersion": 1,
  "office":   { "name": "My Sky Office", "updatedAt": "2026-01-15T15:00:00+08:00" },
  "projects": [ { "id": "launch", "name": "Spring launch" } ],          // optional, for nicer names
  "agents": [
    {
      "id": "pixel", "name": "Pixel", "role": "Frontend", "color": "#4fa3ff",
      "kind": "ai",                  // "ai" (robot) | "human" (person)
      "isBoss": false,               // true = sits on the glowing command platform
      "seat": 3,                     // optional desk id (1..10 in the default layout)
      "status": "working",           // working | idle | stuck | waiting_approval | offline | done
      "currentTask": "Landing page hero",
      "project": "launch",
      "lastActive": "2026-01-15T14:40:00+08:00",
      "tasks": [
        {
          "id": "p1", "title": "Landing page hero", "status": "running",   // running | done | queued | stuck | cancelled | archived
          "project": "launch", "startedAt": "...", "updatedAt": "...", "doneAt": null,
          "progress": 0.6,                                                   // 0..1, optional
          "note": "Waiting for the final copy",
          "subtasks": [ { "title": "Layout", "status": "done" }, { "title": "Copy", "status": "running" } ],
          "confirms": [ { "id": "p1-c0", "question": "Use the blue or the gold hero?", "status": "pending" } ]
        }
      ]
    }
  ]
}
```

Only `agents[].id` and `agents[].name` are required. Everything else has a sensible default.

## What each status looks like

| `status` | In the office |
|---|---|
| `working` | Sits at their desk typing, a small hologram floats over the monitor. If 2+ working agents share a `project` and were active in the last 3 h, they walk to the glass meeting room instead and chat. |
| `idle` | Wanders: coffee bar, bar stools, arcade, sofas, bookshelf, windows, or back to the desk for a while. |
| `stuck` | At the desk with a sweat drop and a spinning swirl over the head; tag turns orange. |
| `waiting_approval` | Walks to the queue in front of the command platform and raises a hand with a red **!** |
| `offline` | Goes to a sleeping pod (charging capsule), `Zzz`. |
| `done` | Cheers with fireworks once, then idles. |
| any status + pending `confirms` | Overlay: red **!** and a hand raise (alternating with typing when working). The count shows on the name tag and in the 待你确认 / *Needs you* tab. |
| pending `confirms` on a **finished** task (`done`, `cancelled`, `archived`, or `archived: true`) | No hand and no count. Listed in a collapsed 「已完成任务上的问题 N」 group in the panel. |
| `isBoss: true` | Crowned robot on the central glowing platform. |

Fireworks also fire once (tracked in `localStorage`) for any task whose `doneAt` is within the last 30 minutes.

## Loading

* `window.VISUAL_OFFICE_CONFIG = { data: 'url.json', adapter: 'auto' | 'workbench' | null, refreshSec: 60, lang: 'zh' | 'en', layout: 'layouts/default.json', links: [{href, label}], replies: {...} }` before the scripts, or
* query string: `?data=url.json&adapter=workbench&lang=en&refresh=60`.

The URL is re-fetched every `refreshSec` seconds (and when the tab becomes visible). On failure the last good data stays on screen; if nothing ever loaded, the embedded snapshot (`<script id="po-data" type="application/json">`) or the sample is shown, and the top bar says which.

## Answering confirms

`VISUAL_OFFICE_CONFIG.replies` takes a reply provider. Without one, the office is read-only, or shows only `onConfirm` buttons.

| member | signature | what it does |
|---|---|---|
| `status` | `(agent, task, confirm) → null \| {state, label?}` | `answered` / `seen` / `handled`: the question leaves "pending", stops counting, and the agent stops raising its hand. `waiting_approval` becomes `idle` when nothing is left. `sending` / `failed` only add a flag. |
| `box` | `(agent, task, confirm) → HTML` | the reply UI drawn under each question (optional) |
| `sync` | `() → Promise` | called before every data refresh (optional) |
| `busy` | `() → boolean` | true while the user is typing, so the panel is not redrawn (optional) |
| `onChange` | `(fn)` | call `fn()` whenever answers change (optional) |

Built-in: `replies: { type: 'http', post: URL, list: URL, headers: {}, credentials: 'same-origin' }`
* POST `post` with JSON `{agentId, taskId, task, confirmId, question, text}`. Any 2xx counts as answered.
* GET `list` returns `{items: [{confirmId, status: 'answered'|'seen'|'handled'|'new', text?}]}`. The server list is authoritative. Unsent answers are kept in `localStorage['gvo.replies']` and retried on the next refresh.

`confirm.id` comes from your data, or defaults to `<taskId>-c<index>`, so keep confirm ids stable.

## Adapters

An adapter turns another format into this schema: `VisualOffice.adapters.NAME = function convert(raw, {now, name}) → data`, with an optional `convert.detect = raw → bool` used by `adapter: "auto"`.
`adapters/workbench.js` is the reference adapter (for the "工作台" task-merge JSON). It also runs in Node:
`node -e "const a=require('./adapters/workbench.js');console.log(JSON.stringify(a.convert(require('./in.json'))))"`.
