# LLM Empire

Commons: a heterogeneous multi-agent game-theoretic war lab, playable in the browser.

Kingdoms compete for land, food and power on a toroidal grid. Public state (land,
army, population) is visible to all; food, stamina, archetype and private scratchpad
notes are secret from rivals but auditable by the operator. Speech is cheap talk:
bulletins and private letters move no resources, but they build alliances, threats
and deception.

Single-file static app: open `index.html`, or deploy the repo to any static host
(it auto-deploys to Cloudflare Pages on every merge to `main`).

## Play

1. Start match opens the setup screen: world size, economy knobs, roster preset.
2. Default roster is `mock`, a fully deterministic local policy engine. No API key,
   no network calls, instant ticks.
3. To run real models, pick `uniform`, `mixed` or `mirror`, set an OpenAI-compatible
   API base (Vercel AI Gateway works) and paste a key. The key is stored only in
   your browser's localStorage. Models receive the Phase A (diplomacy) and Phase B
   (tactics) prompts from the spec and must answer with strict JSON; failures and
   timeouts fall back to the mock policy and log a ThinkTimeout event.
   `typesafe-ai/jev` handles Phase B through the same structured-choice interface;
   Phase A speech falls back to mock for Jev agents.
4. Operator injects: drought rectangle, radio silence, selective mute, raid curfew,
   resource cache drop.
5. Click any kingdom on the map or leaderboard to inspect its secret larder,
   scratchpad, speech and rationale side by side.
6. Export downloads a `.commons.json` with config, seed, full event telemetry and
   per-tick snapshots. Load it back with the replay slider, no inference re-run.
   Telemetry also persists to IndexedDB so the last match resumes on reload.

## Rules implemented

- Pop cap = popBaseCap + popPerCell x land. Dawn upkeep: food >= pop feeds and
  grows pop by 1 (capped); otherwise food is consumed, pop drops 1, army deserts
  to enforce army <= min(armyCap, pop).
- Crops grow +1 per Dawn to level 3. Harvest needs crop >= 2 and 1 stamina,
  yields min(2, 1 + floor(pop/3)).
- Combat: attacker power = army + (stamina>=3); defender power = army + 1 +
  shield + (stamina>=3). Winner takes the cell and loots up to raidLootMax food;
  ties cost both sides 1 army and 1 food. Losing your last cell is a Fall.
- Letters respect Chebyshev range and per-tick caps; speech is truncated to the
  sentence limit with TalkTruncated events.
- Victory: dominion (>= dominionPct% of cells, in dominion/timed modes),
  last stand, timed (maxDays, scored by land/pop/food), or open.

## Dev

`test-engine.mjs` extracts the pure engine block from `index.html` and runs the
spec's acceptance checks headlessly: `node test-engine.mjs`. 18 tests, including
a deterministic 4-player 8x8 100-turn mock match, combat resolution, injects,
trade honor flow, truncation and dominion victory.
