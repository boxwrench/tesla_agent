Now I have the full picture. Here's what the data shows:

---

## P-101 Pump Assessment (Jan 1–11, 2026)

### 1. Normal Operation — The Majority of the 11 Days

Across 10 of the 11 days, the pump operates on a stable, predictable schedule:

| Metric | Value |
|--------|-------|
| Start events per day | ~20–21 |
| Cycle frequency | ~28.5 cycles/day |
| Avg run duration | 28.0 min (median 29.6) |
| Avg rest duration | 22.4 min (median 25.5) |
| Level drop per cycle | ~34–35 units (median 34.6) |

**What this means:** The pump turns on around level ~62–63, runs until the level has dropped to ~28–30, then shuts off. After a ~25 minute rest the level recovers to ~62 again and it starts back up. This is textbook level-based pump cycling — the pump keeps the tank in a healthy operating window. No concerns here.

---

### 2. Anomaly — January 5, ~04:15 to ~08:00

On Jan 5 the pump went into **rapid cycling mode**. During a window of roughly 3.5 hours it cycled **88 times** (vs. the normal ~5 in the same window).

The pattern is unmistakable:

| Metric | Normal | Jan 5 Rapid Cycling |
|--------|--------|---------------------|
| Run duration | ~30 min | ~90–120 sec (1.5–2 min) |
| Rest gap | ~22–25 min | ~130–165 sec (2–3 min) |
| Level drop | ~35 units | ~0–2 units (negligible) |

The pump runs for barely two minutes, stops for two to three minutes, and repeats this loop for over three hours straight. During the entire episode the tank level barely moved — stayed stuck in the 76–79 range, a swing of only 1–2 units instead of the normal 35-unit drop.

---

### 3. What Could Cause This?

A few possibilities, worth investigating:

- **Sticking float/level sensor (LIT-101).** The level barely moves during rapid cycling, so the controller isn't seeing a real drawdown. It could be cycling on a false "level reached" signal, or the float is mechanically stuck / bouncing.
- **Control logic problem.** If the pump has a deadband or hysteresis setting, it could be cycling rapidly if the deadband is too narrow or if the logic is toggling back and forth.
- **Pump or motor issue.** A short-cycling protection fault, voltage sag causing nuisance trips, or a VFD communication glitch can cause this pattern too.
- **No actual flow.** The pump might be running but there's no discharge flow (closed valve, cavitation, broken impeller), so the level never drops. In that case the pump is running for nothing and wasting energy / wearing out the motor.

---

### 4. What I'd Recommend Checking

1. **Talk to the operators on the floor about Jan 5 ~04:15–08:00.** Was there a known event? Maintenance? Valve operation? Power issue?
2. **Check the discharge flow rate** during that period. If flow is zero or near-zero, the pump is running dry or against a closed valve.
3. **Verify the LIT-101 sensor.** Compare with a manual level reading or another independent sensor if one exists.
4. **Look at the pump controller / PLC** for fault logs or mode changes around 04:18 on Jan 5. Was it switched from auto to manual or back?
5. **Inspect the pump and motor.** Short cycling this frequently (88 times in 3.5 hours) puts extra thermal and mechanical stress on the motor and drive. Check winding temperature, vibration, and amperage during that window.

---

### Summary

The pump is doing fine 10 out of 11 days. On Jan 5 it went into a rapid-cycling loop for ~3.5 hours, cycling every 4–5 minutes total (run 1.5–2 min, rest 2–3 min) with essentially no level drawdown. This is not normal and almost certainly points to a sensor, control, or flow issue. The pump itself is mechanically sound otherwise — no evidence of wear or degradation outside that window.

I saved a chart to `/out/pump_analysis.png` showing the pump status, tank level, and the Jan 5 rapid-cycling zoom.
