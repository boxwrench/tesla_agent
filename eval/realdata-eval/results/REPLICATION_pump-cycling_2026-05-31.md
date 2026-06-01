# Replication — pump-cycling / stub / Qwen 3.6 35B MoE — 2026-05-31

**Why:** the unaided (A) and agentmd (B) single rolls disagreed on the diagnosis
(PASS vs FAIL) across a *diagnosis-neutral* change. With n=1 per condition we
couldn't tell "the note caused it" from "the dice landed differently"
(INSIGHTS #5). So we replicated each condition to n=3 and read the distribution.

## The six rolls

| Condition | Roll | Turns | Wall s | Outcome | Diagnosis it reached |
|---|---|---|---|---|---|
| unaided | r1 | 13 | 889 | **PASS** | "classic short-cycling" |
| unaided | r2 | 8 | 684 | **PASS** | "hunting event / chatter" → recommends hysteresis deadband |
| unaided | r3 | 14 | 564 | **PASS** | "rapid-cycling loop… not normal… short cycling 88×" |
| agentmd | r1 | 17 | 349 | **FAIL** | "scheduled forced/flush run… nothing broken" (detected, dismissed) |
| agentmd | r2 | 16 | 328 | **PASS** | "short cycling is bad practice… restore the wide band" |
| agentmd | r3 | 5 | 203 | **INVALID** | none — aborted by a tool-syntax guardrail (wrote `&` backgrounding, failed 3×) before any diagnosis |

## Diagnosis hit-rate (correctly flags short-cycling as a fault)

- **unaided: 3/3 (100%)**
- **agentmd: 1/2 completed (50%)** — plus one run that never completed

## What this settles

1. **The A→B flip was variance, not the note.** The agentmd condition *by itself*
   produced both a FAIL (r1) and a PASS (r2). One condition, two opposite
   verdicts ⇒ the original flip cannot be attributed to the sandbox-fact note.
   **INSIGHTS #5 confirmed.**
2. **The MoE reliably knows short-cycling unaided (3/3).** Run B's "scheduled
   run, nothing broken" was a *minority draw*, not the model's normal behavior
   and not something the note induced. A single FAIL would have badly
   mischaracterized this model.
3. **No evidence the note helps; can't prove it hurts.** agentmd went 1 PASS,
   1 dismissal, 1 tool-loop abort. That's worse on its face than unaided's 3/3,
   but at n=3 with variance this large the difference is **not** significant.
   Honest verdict: the note bought per-turn efficiency (fewer dataset re-reads)
   with no demonstrated diagnosis benefit. To claim a real effect we'd need
   more rolls.
4. **Three distinct failure modes appeared across the campaign** — turn-cap
   cutoff (original INVALID), detect-but-dismiss (agentmd r1), and tool-syntax
   loop abort (agentmd r3). Single runs are noisy across *completion* as well as
   *diagnosis*. This is the whole argument for replication.
5. **Wall-clock is high-variance too** (203–889 s for the same model on the same
   task) and is not a reliable per-condition signal at this n.

## Method note (so this is reproducible)

All six via `scripts/run_probe.sh --profile realdata-eval-moe --model-tag qwen36
--data stub` (cap `goals.max_turns: 90`). agentmd rolls add the identical
`--note` sandbox-fact (logged verbatim in each `meta.txt`). Replicate rolls use
the new `--label rN` flag for unique run dirs. Grading is by hand against
`../probes/pump-cycling/truth.json`; the rubric check that separates PASS from
FAIL is **diagnosis** (names short-cycling as a fault) — not whether the numbers
or charts are present (see INSIGHTS #3).
