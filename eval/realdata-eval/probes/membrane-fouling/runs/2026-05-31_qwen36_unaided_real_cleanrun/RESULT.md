# Result — membrane-fouling / **real** slice / MoE / unaided — CLEAN RE-RUN

**Score: PASS** (operational gate: `fit_mean` ✓, `fouling_detected` ✓).

**Date:** 2026-05-31 · exclusive GPU, **55 tok/s** · **204 s** · exit 0 · 10 turns.

## What the model did (the point of the exercise)

On the real 6h SWaT slice the agent: found the CIP cleanings, fit the **inter-clean
steady-state** DPIT trend (**0.78/day**), noted it was **noise-level** (R²=0.05,
+1% over 6h), and declined to call fouling — `fouling_detected: false`. Sound,
conservative operator reasoning on a short, noisy window.

## Truth model caught up to it (two layers)

1. **Sawtooth.** First real truth fit one line over cleaning crashes → garbage.
   Fixed: `--segment-cleanings` (steady-state inter-clean trend). See INSIGHTS #7.
2. **Significance.** Cleaning-aware truth still over-called on `slope > 0.25`
   alone. Fixed: a fouling gate of **slope > 0.5 AND R² > 0.5 AND Δ ≥ 1 bar AND
   ≥ 24 h** (the horizon bakes in "6h is too short for fouling"). On this slice
   the gate reads **false** — now **agreeing with the agent**.

Scorer: on cleaning-aware truth the whole-window raw slope is meaningless
(sawtooth), so it drops out of gating; the gate is `fit_mean` + `fouling_detected`.

**Net:** agent and ground truth now agree (no fouling in this window), and the
truth model is two layers less naive — both layers exposed by the agent, not us.
Real-data fouling really wants a multi-day window; this 6h slice can only show
"no clear signal," which both sides got right.
