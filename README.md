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

- Kingdoms start with 12 food, 8 minerals, 2 population, 1 army, 1 house and
  4 stamina. Stamina recovers +3 each Dawn to a cap of 6.
- Fields grow one crop stage each Dawn to level 3. Harvesting a ready field
  costs 1 stamina and yields 3 food. Mines refill one ore each Dawn to a cap
  of 5; mining costs 1 stamina and yields up to 3 minerals.
- Every person eats 1 food per Dawn. Population grows by 1 when fully fed and
  shrinks on a deficit. Houses cost 2 minerals and support 4 people each, with
  up to 3 houses per tile. Building costs 1 stamina.
- Training 1 army costs 2 minerals and 1 stamina. In timed and open modes,
  every soldier also costs 1 mineral per Dawn; unpaid upkeep causes desertion.
  Army cannot exceed population or the army cap.
- Armies are placed units and may split or merge. Conquering any tile, even an
  empty one, requires an army group on the frontier and costs 1 stamina.
  Attacks cost 1 stamina; houses normally give defenders +2 and mines +1.
- Dominion and last stand use war pacing: population cannot starve below 2,
  army upkeep is waived, an army that reaches zero raises a 1-unit militia at
  Dawn, attackers get +1, and passive terrain, house and shield defense is
  removed. Dominion wins at 25% of the map. Capturing a capital eliminates its
  kingdom and transfers all remaining territory to the attacker.
- Letters respect range and per-tick caps; speech is truncated to the sentence
  limit with TalkTruncated events.
- Victory: dominion, last stand, timed (day limit, scored by land, population,
  food and related resources), or open.

## Dev

`test-engine.mjs` extracts the pure engine block from `index.html` and runs the
spec's acceptance checks headlessly: `node test-engine.mjs`. 18 tests, including
a deterministic 4-player 8x8 100-turn mock match, combat resolution, injects,
trade honor flow, truncation and dominion victory.
