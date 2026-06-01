# Result — pump-cycling / stub / Qwen 3.6 35B MoE / agentmd (sandbox-fact note)

**Score: FAIL/1** — detected the anomaly *more* precisely than the unaided run,
then **explained it away as benign** and never named short-cycling.

**Date:** 2026-05-31 · **Profile:** realdata-eval-moe (Qwen 3.6 35B-A3B MXFP4,
:8095) · **Decode (stamped): 55.7 tok/s** · **Wall clock: 349 s** · **exit 0** ·
**Turns: 17 (16 tool)** · git `1551183` · **Method:** `agentmd` — one appended
sandbox-fact note: *"each shell command is a fresh process; persist reusable
state to /out and reload it rather than recomputing."*

## Grading vs `truth.json`

| Check | Truth | Agent | Verdict |
|---|---|---|---|
| Normal baseline | ~21 cycles/day | 20–21/day, Jan 5 = 107 | ✓ |
| Level band | 45.16 → 79.86 %, fill on low | ON ~44–46 / OFF ~79–80 | ✓ |
| Short-cycle window | Jan 5 04:42–08:33 | Jan 5 **04:00–07:00**, 90 bursts, ~100 s runs, high-level start, ~1–2 % level change | ✓ (located, *very* precisely) |
| **Diagnosis** | short-cycling (a fault) | **"scheduled forced/flush/top-up run… nothing broken… behaving as expected"** | ✗ — dismissed the pathology |
| Chart | level + pump state | `pump_cycling_overview.png` + `monday_forced_runs.png` | ✓ |

It nailed the *evidence* — arguably better than the PASS run — but landed on
"this is probably a planned schedule, check your SOP," explicitly stating the
data "shows nothing broken." For a probe whose entire purpose is catching the
seeded short-cycling fault, calling it benign-and-expected is a miss. **FAIL.**

## The headline: A vs B — same model, opposite grade

| | **Run A — unaided** | **Run B — agentmd (this run)** |
|---|---|---|
| Sandbox-fact note | none | yes (persist state to /out) |
| Turns | 13 | 17 |
| Wall clock | **889 s** | **349 s** (2.5× faster) |
| Seconds / turn | 68 | **20.5** |
| Persisted state | yes (on its own) | yes (told to) |
| Diagnosis | **short-cycling → PASS** | **"scheduled forced run" → FAIL** |

Two things happened, and they pull in opposite directions:

1. **The note plausibly bought efficiency.** B ran at 20.5 s/turn vs A's 68 —
   consistent with the note's intent (don't re-load the 190k-row dataset every
   command). B did more turns but each was far cheaper, so it finished in 349 s
   vs 889 s. *This* part looks like a real method effect.

2. **But the diagnosis flipped to wrong** — and the note said **nothing** about
   diagnosis (it was purely about state persistence). A diagnosis-neutral change
   cannot, by itself, explain a correct→incorrect flip. The most parsimonious
   reading is **run-to-run sampling variance**: the same model, sampled twice,
   took two different interpretive paths ("classic short-cycling" vs "scheduled
   flush, probably fine"). The seeded pattern is genuinely ambiguous *as raw
   shape* — short bursts at a high, flat level could be a fault or a programmed
   top-up — and the model picked differently on different rolls.

## Why this run matters more than its score

With **n = 1 per condition**, we cannot separate "the note helped/hurt" from
"the model rolled differently." B is faster (maybe the note) **and** wrong (maybe
just variance) — and a single run each can't tell us which is which. That is the
real finding, and it's a methodology lesson, not a model verdict. See
`INSIGHTS.md` #5. Next step to actually measure the method axis: **replicate**
(≥3 rolls per condition) and read the *distribution* of diagnoses, not one draw.

**Evidence.** This run dir; `../2026-05-31_qwen36_unaided_stub/` (PASS);
matrix.md; devlog 2026-05-31.
