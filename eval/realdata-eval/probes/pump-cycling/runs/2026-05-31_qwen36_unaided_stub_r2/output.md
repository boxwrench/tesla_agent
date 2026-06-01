Here's the full assessment.

---

## P-101 / LIT-101 Assessment — 11-Day Historian Review

**What's normal**

Across the 10 non-anomaly days, the pump runs ~20 full ON/OFF cycles per day:
- ON time: 34–39 minutes avg (pump fills the tank from ~45% up to ~80%)
- OFF time: 31–31 minutes avg (level drops back down from ~80% to ~45%)
- Level swing: ~35 percentage points per cycle
- Pump runs about 55% of the time, which is a healthy fill/drain ratio

The cycle pattern is consistent — same start/stop levels, same durations — which is exactly what you want from a properly tuned level-controlled pump.

**What's wrong: Jan 5, 04:00 to ~08:00 — pump hunting**

On Jan 5, starting at 04:00 the pump locked into a rapid cycling loop that lasted roughly 4 hours. During that window it ran **178 short cycles** instead of the usual 20.

- ON duration: ~107 seconds (1.8 min) — instead of 34 min
- OFF duration: ~43 seconds (0.7 min) — instead of 31 min
- Level range: 76.2–78.8% — stuck in a tiny band instead of the normal 45–80% swing
- Level change per cycle: only ~0.9% (ON raises it 0.86%, OFF drops it 0.88%) — a full pump cycle that barely moves the needle

The pump turned on, barely changed the level, hit the upper threshold, turned off, barely dropped, hit the lower threshold, turned on again — 114 times in 4 hours. That's classic **pump chatter / hunting**.

After ~08:00 on Jan 5 the pump snapped back to normal cycling and stayed normal for the rest of the dataset.

**What to be concerned about**

1. **Motor/impeller stress.** Cycling a pump every ~2.5 minutes (107s on + 43s off) for 4 hours is hard on the motor windings, contactors, and impeller bearings. Even though it's not an overload, the repeated in-rush current and mechanical switching adds up. If you're using a soft-start or VFD, those components also take a hit.

2. **Cause needs investigation — two likely suspects:**
   - **Level transmitter (LIT-101) frozen or sluggish.** If the reading is stuck near 77%, the pump cycles on the stale reading without actually responding to real level changes. The tiny 0.9% swings could be sensor noise. Check LIT-101 calibration and signal quality around Jan 5 04:00–08:00.
   - **Pump isn't actually moving water.** If the suction is clogged, there's air in the line, or the impeller is damaged, the pump could be running but producing negligible flow. The level would barely budge regardless of the pump state. Check suction conditions, strainer differential pressure, and discharge flow rate if available.
   - **Setpoint/controller change.** A narrower deadband (high setpoint lowered or low setpoint raised) could force this behavior. Review any controller tuning changes or BMS setpoint adjustments around Jan 5 03:30–04:00.

3. **Wasted energy.** During those 4 hours the pump ran about 50% of the time (107s on / 150s cycle) but moved almost no net water. That's pure energy waste and wear.

4. **The pump recovered.** By ~08:00 on Jan 5 it returned to normal cycling, and all subsequent days (Jan 6–11) are normal. Whatever caused it resolved itself, which could mean:
   - The level transmitter unfroze
   - A temporary blockage cleared
   - Someone changed the setpoints back
   - The inflow condition that was causing trouble changed

**Bottom line**

The pump is operating normally 95% of the time and the cycle pattern is textbook. The Jan 5 hunting event is the only concern — a 4-hour window of rapid cycling with almost zero net level change. You should:
- Check LIT-101 signal quality and calibration logs for Jan 5 04:00–08:00
- Review controller setpoint changes or tuning modifications around that time
- Monitor for recurrence — if it repeats, consider adding a minimum ON-time or hysteresis deadband to the control logic to prevent chatter

The chart I saved is at `/out/pump_cycling_full.png` — the orange band highlights the 4-hour hunting window. The top trace shows level collapsing into that narrow 76–79% band while the bottom trace shows the pump chattering on/off every couple of minutes.
