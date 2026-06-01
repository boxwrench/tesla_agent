# Result — membrane-fouling / **real** slice / Qwen 3.6 35B MoE / unaided

**Score: INVALID (do not grade) — but the most informative run of the project.**

**Date:** 2026-05-31 · **Profile:** realdata-eval-moe · **Decode: 20 tok/s**
(GPU shared with Track B → ~2.7× slower) · **Wall: 820 s** (near the 900 s cap) ·
**Turns: 8** · **exit 1** · **Data:** `data/real_slices/membrane_real_v1.parquet`
(2015-12-29 00:00–06:00, DPIT-301/FIT-301).

## Why INVALID

1. **The run crashed.** Hermes raised `KeyError: 'final_response'` — the known
   one-shot gotcha when a run **ends on a tool call** (no final assistant prose;
   final_answer was 77 chars: *"Let me write the final analysis and chart."*).
   `run_probe.sh` still recovered `answers.json` + the session, but the agent
   never wrote its closing brief.
2. **`answers.json` is internally inconsistent** with the agent's own reasoning:
   it reports `dpit_slope_per_day: -7.54` (negative!) yet `fouling_detected: true`
   — a hastily-emitted, pre-crash value that contradicts the +0.80/day trend its
   session actually computed. Not a trustworthy verdict.
3. Decode was throttled to 20 tok/s by GPU contention, pushing it to the timeout
   edge. A clean re-run needs the full GPU.

**So this is not a model verdict.** But what it surfaced is the real prize.

## The finding: real data is sawtooth, and our truth model is too naive for it

The stub is a clean monotonic fouling ramp. The **real** 6-hour window is **not**
a ramp — it's a **sawtooth**: DPIT-301 sits at ~19.9 bar, then crashes to ~2 bar
repeatedly. Independently verified on the slice: **18.5% of points sit below
10 bar (mid-clean)**, median 19.83. The agent identified **13 CIP cleaning
events** in the window.

Our `build_truth.py` fits **one linear slope across the whole window** — which is
meaningless on sawtooth data (it averages the cleaning crashes into the trend),
giving `dpit_slope_per_day = 0.2748`, `fouling_detected: false`.

The agent did the **more correct** thing: it *separated the cleaning cycles from
steady operation* and fit the **inter-clean steady-state trend** — getting
**~0.80 bar/day (R²=0.30, p<0.001)** and judging `fouling_detected: true`. On a
real, cyclically-cleaned membrane, the steady-state inter-backwash rise is
exactly what an engineer would look at. **The agent's method out-reasoned our
ground-truth builder.**

## Consequences

- **Real-data membrane grading is BLOCKED** on a cleaning-cycle-aware truth model.
  `truth.real.json` (single-line fit) should **not** be used to PASS/FAIL a real
  run — it would fail a *better* analysis. Flagged provisional in PROBE.md.
- **The infrastructure works** end-to-end: slice → agent → `answers.json` →
  auto-grade. `make_real_slice.py` + `data_paths.sh` + the dual-truth layout are
  validated; only the truth *model* needs upgrading.
- **Hermes `KeyError: final_response` recurred** (memory: `hermes_oneshot_gotchas`).
  The session-JSON capture saved the work, but a closing-prose nudge or a
  post-loop final-answer fetch in the harness would make these runs clean.

## Next

- A cleaning-aware real truth (segment on FIT/DPIT drops → inter-clean slope;
  or grade "steady-state fouling rate" instead of whole-window slope) — a domain
  call. Then re-run on full GPU.
- See INSIGHTS #7.
