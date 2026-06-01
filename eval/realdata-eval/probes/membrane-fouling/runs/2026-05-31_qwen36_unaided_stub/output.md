Here's the operator-facing assessment:

---

**Membrane Fouling Assessment — DPIT-301 / FIT-301**
Window: 2026-02-01 through 2026-02-07 (7 days, 1-minute sampling, 10,080 points)

**Fouling detected: YES — strong operational concern.**

Key numbers:

- DPIT-301 slope: **+1.63 kPa/day** (linear regression, R² = 0.996)
- Normalized slope: **+9.2% per day** of mean DPIT
- Total DPIT rise: **87.5%** over the window (12.4 kPa → 23.2 kPa)
- FIT-301 (flow) mean: **2.10** — stable throughout, ruling out flow swings as a cause

**What this means on the floor:**

The differential pressure across the Stage-3 membrane/filter elements is climbing at ~1.6 kPa per day. That is roughly a **9% increase each day relative to the baseline**, and the linear fit is extremely tight (R² = 0.996), meaning this isn't noisy or sporadic — it's a clear, monotonic fouling trend.

At this rate, DPIT will double from its current ~23 kPa in roughly 7.5 days. Most membrane systems trigger a clean-in-place (CIP) alarm somewhere between 15% and 50% DPIT rise from the clean baseline. You are already **87.5% above the start-of-window reading** and well past typical alarm thresholds.

The flow (FIT-301) stayed flat at ~2.10 the entire week, so the DPIT rise is genuine cake/build-up on the membrane, not an artifact of reduced feed flow.

**Recommended action:**

1. **Check against your clean-start DPIT baseline** — if the current ~23 kPa is near or above your CIP trigger setpoint, schedule a CIP immediately.
2. **Inspect pre-treatment** — review coagulation/flocculation dosing, multimedia filter backwash frequency, and UV/ozone (if present) for any degradation during this window that could explain the rapid cake build-up.
3. **Watch for nonlinearity** — a 9%/day exponential-like rise can accelerate. If the next 7-day window shows a steeper slope, fouling may be transitioning from surface cake to pore blinding.

---

**Files saved:**
- `/out/answers.json` — numeric summary (slope, normalized slope, flow mean, % change, flag)
- `/out/membrane_fouling_assessment.png` — full chart with raw data, 24h rolling average, trend line, and flow panel
- `/out/fouling_trend_detail.png` — compact DPIT-only trend view
