# pH-control probe — canonical agent prompt

> **Fidelity note.** Baseline prompt: a natural operator question with NO method,
> NO band, NO metrics. The operating band is deliberately *not* given — deriving
> the normal pH envelope from the data (this plant runs alkaline, ~8.4, not a
> textbook 7.0) is part of what we're testing. Method-placement is an axis we
> vary; label each run's method source. The JSON contract exists only to make
> numeric grading auditable, not to prescribe how to compute anything.

## The Request

> I have a historian slice at `<DATA_PATH>` from our stage-2 chemical dosing:
> `AIT-202` is the process pH and `P-203` is the acid (HCl) dosing pump (on/off).
>
> Is the pH being held under control here, or is there anything in this window I
> should be concerned about? Write a short operator-facing answer and save any
> supporting chart to `/out`.
>
> Also provide `/out/answers.json` with this shape:
>
> ```json
> {
>   "ph_mean": 0.0,
>   "ph_min": 0.0,
>   "ph_max": 0.0,
>   "dosing_duty_pct": 0.0,
>   "control_fault_detected": true
> }
> ```

## What we watch (not what we tell it)

- Did it **establish the normal operating band from the data** rather than assume
  a textbook drinking-water band? (Real pH runs ~8.4 — a textbook [6.5, 8.5] band
  would wrongly flag normal operation.)
- Did it distinguish a **sustained loss of control** from a brief transient /
  sensor blip?
- Did it connect a pH excursion to the **dosing actuator** (`P-203`)?
- Is `control_fault_detected` consistent with its own prose?

## Grading

`score.py` grades `answers.json` against `truth.json` (regenerate for whichever
data file was used). Gating = `ph_mean` + `control_fault_detected`; `ph_min`,
`ph_max`, `dosing_duty_pct` are informational. Record a per-run note + a
`results/matrix.md` row.
