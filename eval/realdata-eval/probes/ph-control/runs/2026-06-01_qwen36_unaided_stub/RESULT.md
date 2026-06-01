# Result — ph-control / stub / MoE / unaided

**Score: PASS** (gating: `ph_mean` ✓ exact, `control_fault_detected` ✓ true).

**Date:** 2026-06-01 · sole-GPU · 199 s · exit 0 · 13 turns.

The agent established the operating pH (~7.55), found the seeded acid-overdose
window (pump stuck ON → pH crash to 5.53), reported it as a sustained control
fault, and reproduced the truth numbers exactly (ph_mean 7.509, ph_min 5.5292).
Clean detection of a planted control fault on a 7-day window.
