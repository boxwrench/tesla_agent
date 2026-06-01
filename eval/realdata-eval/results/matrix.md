# Scoreboard

One row per agent run, across all probes. Newest at the top.

| Date | Probe | Stack | Strategy | Method source | Score | Notes |
|---|---|---|---|---|---|---|
| 2026-06-01 | ph-control (**real**) | qwen36-moe | oneshot | unaided | **PASS** | 268s/14 turns. Did NOT fall for the textbook-band trap (treated pH ~8.37 as normal, never flagged the alkaline baseline). Found the real event: acid pump P-203 OFF at 12:00:33 → pH crash to 6.0 for 3m19s → recovered; tied to actuator; root-caused as control-signal not reagent. Initially FAIL (agent `fault=true` vs truth `false`/sustained-only); **operator ruled the agent right** — a 3-min pH-6.0 slug is a water-quality event. Truth fixed (acute-breach trigger), now agree → PASS. 4th agent-vs-truth win, 1st expert-adjudicated. INSIGHTS #10. |
| 2026-06-01 | ph-control (stub) | qwen36-moe | oneshot | unaided | **PASS** | 199s/13 turns. Found the seeded acid-overdose (pump stuck ON → pH crash 7.55→5.53), called it a sustained control fault, reproduced truth numbers exactly (ph_mean 7.509, ph_min 5.5292). Clean planted-fault detection. |
| 2026-06-01 | membrane-fouling (**real**) | qwen36-moe | oneshot | unaided | **PASS** | Reliability batch rel1, exclusive GPU, 209s/12 turns. Segmented cleanings, declined fouling (false) — same sound reasoning as cleanrun. fit_mean 2.2131 (rel 0.002). See INSIGHTS #9. |
| 2026-06-01 | membrane-fouling (**real**) | qwen36-moe | oneshot | unaided | **FAIL** | Reliability batch rel2, 330s/12 turns. **Ended on a tool call** ("Now let me create the charts…") → truncated synthesis; recovered `answers.json` used the **unfiltered** mean (fit_mean 1.84 vs 2.21, rel 0.17, includes cleaning zeros) and fouling=true. Completed (exit 0, gradeable) but a weaker answer — the honest "stumble." INSIGHTS #9 rule 3. |
| 2026-06-01 | membrane-fouling (**real**) | qwen36-moe | oneshot | unaided | **FAIL** | Reliability batch rel3, 185s/11 turns. Did the *same* analysis as rel1 (slope 0.7753, R²=0.05, fit 2.1488) and wrote a conservative prose verdict ("Do not trigger maintenance on this 6-h slice alone; confirm over 48 h") — **but set `fouling_detected=true`.** Boolean disagreed with its own narrative. The one-bit verdict is noise on a borderline window. INSIGHTS #9. |
| 2026-05-31 | membrane-fouling (**real**) | qwen36-moe | oneshot | unaided | **PASS** | Clean re-run, exclusive GPU, 204s. Agent: steady inter-clean slope 0.78/day but noise-level (R²=0.05, +1%/6h) → fouling=false. After two truth-model fixes the agent itself forced (sawtooth segmentation, then a significance+horizon gate: slope>0.5 ∧ R²>0.5 ∧ Δ≥1bar ∧ ≥24h), the cleaning-aware truth also reads **false** — agent and truth agree. Whole-window slope drops out of gating on sawtooth data. See RESULT.md, INSIGHTS #7. |
| 2026-05-31 | membrane-fouling (**real**) | qwen36-moe | oneshot | unaided | **INVALID** | Crashed (`KeyError: final_response`, ended on tool call) at 820s/20 tok/s under GPU contention. **But the key finding of the project:** real data is **sawtooth** (DPIT crashes ~19.9→~2 at 13 CIP cleanings; 18.5% mid-clean). Our linear `truth.real.json` (0.2748/day, fouling=false) is **too naive** for it; the agent *separated cleaning cycles* and fit the inter-clean steady trend (~0.80/day) → fouling=true — a **better** analysis than our truth. Real-data grading blocked on a cleaning-aware truth. See RESULT.md / INSIGHTS #7. |
| 2026-05-31 | membrane-fouling (stub) | qwen36-moe | oneshot | unaided | **PASS** | Replicate r3. 6 turns, 82s. Operational gate ✓ (slope exact, fouling ✓). |
| 2026-05-31 | membrane-fouling (stub) | qwen36-moe | oneshot | unaided | **PASS** | Replicate r2. 8 turns, 87s. Operational gate ✓ (slope exact, fouling ✓). |
| 2026-05-31 | membrane-fouling (stub) | qwen36-moe | oneshot | unaided | **PASS** | Replicate r1. Completed in 99s. Operational gate (raw DPIT slope ✓ exact, mean flow ✓ exact, fouling flag ✓) all pass + a strong operator brief (CIP rec, R²=0.996). Two derived metrics still diverge (normalized slope: `truth` DPIT/FIT² vs agent %-of-mean-DPIT/day; change_pct: edge-median 78.16 vs endpoint 87.5) — now **informational, not gating**, since the prompt doesn't pin their definition (rubric-contract fix; truth metrics unchanged). Was FAIL/2 under the old all-must-pass rule. |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | agentmd | **INVALID** | Replicate r3. Aborted at 5 turns — tool-syntax guardrail (model wrote `&` backgrounding, failed 3×), never reached a diagnosis. Third distinct failure mode. See REPLICATION rollup. |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | agentmd | **PASS/1** | Replicate r2. 16 turns, 328s. "Short cycling is bad practice… restore the wide band." ⇒ agentmd produces both PASS (here) and FAIL (r1) ⇒ the A→B flip was **variance, not the note**. |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | unaided | **PASS/1** | Replicate r3. 14 turns, 564s. "Rapid-cycling loop… not normal… short cycling 88×." |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | unaided | **PASS/1** | Replicate r2. 8 turns, 684s. "Hunting event / chatter" → recommends hysteresis deadband (the anti-short-cycling fix). |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | agentmd | **FAIL/1** | **Same model as the PASS row, +1 sandbox-fact note (persist state to /out).** 17 turns, **349s @ 55.7 tok/s — 2.5× faster** per the note's efficiency intent (20.5 vs 68 s/turn). Located the window *more* precisely (90 bursts, ~100s runs) but **dismissed it** as a "scheduled forced/flush run, nothing broken" — never named short-cycling. Diagnosis flipped PASS→FAIL on a diagnosis-neutral change ⇒ **run-to-run variance**, not the note. n=1 can't separate the two — see INSIGHTS #5. |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | unaided | **PASS/1** | **Fair re-run** (cap 20→90, session-JSON capture). 13 turns (10 tool), 889s @ 54.5 tok/s. Baseline ✓, band 45–80 ✓, **named short-cycling** ✓ (Jan 5 04:17–08:00, within tol), 2 charts. Persisted intermediates to `/out` on its own — no re-`read_parquet` thrash. Supersedes the INVALID cutoff below. |
| 2026-05-31 | pump-cycling (stub) | gemma31-dense | oneshot | unaided | FAIL/1 | starts 314 ✓ exact, band 44–81 ✓, fill ✓; **missed the seeded short-cycle window** (the main pathology) — called it setpoint/controller instability instead. Numeric miss is material. 348s @ ~8 tok/s, 2 charts. |
| 2026-05-31 | pump-cycling (stub) | qwen36-moe | oneshot | unaided | ~~INVALID~~ | **Superseded** by the PASS re-run above. Original cutoff: hit `goals.max_turns:20` after 20 shallow tool rounds, guillotined before writing an answer. Kept as `_CUTOFF20` for the harness-fault record. |

**Method source** (the honesty column): `unaided` / `prompt` /
`agent.md` / `skill:<name>`. Records where the analysis method came
from so the board never conflates "the agent figured it out" with "we
handed it the recipe." Both are valid results — label them.

## Conventions

- **Score** — `OK` if all numeric checks passed; `FAIL/N` if N checks
  failed. Prefer this over a percent so the column reads at a glance.
- **Stack** — model + backend short-tag: `qwen35-moe`, `qwen122-mxfp4`.
- **Strategy** — `oneshot`, `plan-execute`, `react`.
- **Workflow** — short tag for the prompt + tool surface variant.

When patterns emerge (one stack always wins, one strategy always
loses, etc.), summarize them at the bottom of this file.

## Patterns so far (2026-05-31)

**MoE diagnosis hit-rate, n=3 unaided per probe:**

| Probe | Hit-rate | Spread |
|---|---|---|
| pump-cycling (stub) | 3/3 | high variance — one *other* roll (agentmd) dismissed the same fault as a "scheduled run" |
| membrane-fouling (stub) | 3/3 | very low variance — raw slope **exact** all 3 rolls, identical informational divergence each time |

**Variance scales with how ambiguous the underlying signal is.** Membrane fouling
is a monotonic DPIT rise (R²≈1) — unmistakable — so the model is near-deterministic
on it (3/3, same numbers, same method choice every roll). Pump short-cycling at a
high, flat level is genuinely ambiguous as raw shape (fault vs programmed top-up),
so the *same* model flips diagnoses across rolls (INSIGHTS #5). Takeaway: run-to-run
variance is **not** a fixed property of "LLM agents" — it tracks task interpretability.
Budget more replicates for ambiguous-signal probes; clear-signal probes need fewer.
