---

**Operator-facing assessment**

**What we looked at**
- **DPIT-301** — differential pressure across the membrane stage. This is your primary fouling indicator.
- **FIT-301** — feed flow rate. Should stay roughly constant if the upstream pump is stable.
- Data span: **Feb 1 00:00 – Feb 7 23:59** (10,080 one-minute samples, ~7 days).

**Key numbers**

| Metric | Value | What it means |
|---|---|---|
| DPIT slope | **+1.63 kPa/day** (linear fit, R² = 0.996) | Differential pressure is climbing steadily, not just wobbling around a set-point. |
| Normalized slope | **0.0919 per day** (~9.2 % of mean ΔP per day) | A strong relative increase — the membrane is losing permeability fast. |
| DPIT change over window | **+87.5 %** (12.36 → 23.17 kPa) | Nearly double the initial pressure drop. |
| FIT-301 mean | 2.10 (std 0.04) | Flow is stable; the DPIT rise is **not** driven by flow changes. |

**Does this matter operationally?**

**Yes. This window shows clear, significant fouling.** A ~87 % rise in transmembrane differential pressure over 7 days is well above the typical foul-warning threshold (30–50 % rise). The linear fit has an R² of 0.996, meaning the trend is very consistent and not just noise.

**Recommended next steps for the operator:**
1. **Check the last 2–3 days** against your standard operating limit for DPIT. If it's already exceeded or approaching the limit, plan a **chemical cleaning** (CIP) on the next available shut-down.
2. Review whether any upstream change coincided with the start of fouling (e.g., raw-water turbidity spike, coagulant dosing shift, or pre-filtration failure) — the slope starts near-linear from the first day, so the foulant loading likely began early in the window.
3. Keep monitoring FIT-301. If flow starts to drop while ΔP keeps rising, you may be seeing combined fouling + pump degradation.

Files produced:
- `/out/fouling_assessment.png` — two-panel chart (top: DPIT with regression line; bottom: FIT with mean line)
- `/out/answers.json` — numeric results in the requested schema
