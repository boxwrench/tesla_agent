# Result — ph-control / **real** slice / MoE / unaided

**Score: PASS** (after the operator-ruled truth fix — see below).

**Date:** 2026-06-01 · sole-GPU · 268 s · exit 0 · 14 turns.

## What the agent did (operator-auditable)

It did NOT fall for the textbook-band trap: it treated pH ~8.37 as the normal
operating point and never flagged the alkaline baseline. It found the real event —
acid pump P-203 switched OFF at 12:00:33, pH crashed to 6.0 for 3m19s, recovered
at 12:03:51 — tied it to the actuator, and reasoned the root cause was a
control-signal fault, not a reagent problem. Sound, specific, actionable.

## Agent vs truth — the agent won (INSIGHTS #10)

Initially graded FAIL: agent said `control_fault_detected=true`, truth said
`false` (our gate required a *sustained* ≥30 min excursion). The domain expert
ruled that a 3-minute slug of pH-6.0 water is a real water-quality event
regardless of duration. Truth fixed to fire on EITHER a sustained drift OR an
acute breach of fixed limits [6.5, 9.0]. Now truth=`true` (trigger: acute_breach)
— agent and truth agree, **PASS**. Fourth time the agent exposed a flaw in our
ground truth, first one adjudicated by the expert.
