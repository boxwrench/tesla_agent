# Result — pump-cycling / stub / Qwen 3.6 35B MoE / unaided (FAIR RE-RUN)

**Score: PASS/1** — identified, *named*, and located the seeded short-cycling.

**Date:** 2026-05-31 · **Profile:** realdata-eval-moe (Qwen 3.6 35B-A3B MXFP4,
:8095) · **Decode (stamped): 54.5 tok/s** · **Wall clock: 889 s** · **exit 0** ·
**Turns: 13 (10 tool)** · git `da5ad3f`

This supersedes the `_CUTOFF20` run (INVALID), which was guillotined at the old
`goals.max_turns: 20`. With the cap raised to 90 and session-JSON capture wired
into `run_probe.sh`, the MoE finished cleanly and produced a complete report.

## Grading vs `truth.json`

| Check | Truth | Agent | Verdict |
|---|---|---|---|
| Normal baseline | ~21 cycles/day, 314 ON segments | daily breakdown exact (21/day; Jan 5 = 107) | ✓ |
| Level band | 45.16 → 79.86 %, fill on low | "turn on at ~45%", ON 45→80 / OFF 80→44 | ✓ (within 2 % abs) |
| Short-cycle window | 2026-01-05 04:42–08:33, peak 25 starts/hr | Jan 5 ~04:17–08:00, 107 ON/108 OFF vs 21 | ✓ (within 30-min tol) |
| **Diagnosis** | short-cycling | **"This is classic short-cycling behavior."** | ✓ — *the* check Gemma missed |
| Chart | level + pump state over time | `pump_analysis.png` + `pump_zoom_jan5.png` | ✓ |

## Why this run worked where the cutoff didn't

Two things changed, and a third emerged from the model:

1. **Fair turn budget** (`goals.max_turns` 20→90). It needed 13 turns — the old
   cap cut it off mid-exploration at 20 *shallow* rounds last time, but with room
   it consolidated instead of thrashing.
2. **Session-JSON capture.** The run still ended with prose in the final
   assistant turn; `extract_session.py` recovered `answer.md` + transcript
   regardless of stdout.
3. **It persisted state on its own.** Unaided, it wrote intermediates to `/out`
   (`on_segments.csv`, `off_segments.csv`, `on_durs.npy`, `off_durs.npy`) and
   reused them — it did *not* re-`read_parquet` 10× like the cutoff run. So the
   "re-loads the whole dataset every turn" pathology was **not** intrinsic to the
   model; under a fair budget it managed state correctly without being told to.

## The comparison this completes (speed+quality pair)

| | Gemma 31B (dense) | Qwen 3.6 35B (MoE) |
|---|---|---|
| Decode | 8.1 tok/s | 54.5 tok/s |
| Turns | ~2 tool calls | 13 (10 tool) |
| Wall clock | 348 s | 889 s (still longer) |
| Deliverable | full report | full report |
| **Diagnosis** | setpoint/controller (wrong) → **FAIL** | **short-cycling (right)** → **PASS** |

The slower dense model was faster end-to-end but reached the *wrong* diagnosis;
the faster MoE took longer (more tool rounds) but reached the *right* one. Speed
and correctness traded in opposite directions — exactly the case for end-to-end
task eval over decode-speed leaderboards.
