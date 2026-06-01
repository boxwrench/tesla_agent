Here's my full assessment:

---

**PUMP P-101 / TANK LEVEL ANALYSIS — 11 DAYS (Jan 1–11, 2026)**

**Overall health: GOOD, with one significant abnormal event on Jan 5.**

---

### Normal Operation (Days 1–4, 6–11)

The pump is doing its job well 10 out of 11 days:

- Clean binary cycling: **on for ~30 minutes, off for ~37 minutes**, repeating ~20–21 times per day.
- Tank level swings from **~44 (low) to ~80 (high)** each cycle — a ~36-unit range.
- Pump ON duty cycle: **~55%** (fills the tank more than half the time).
- No short-cycling events at all. The pump doesn't "bounce" — each run is a proper, full cycle.

This is exactly how a well-tuned fill pump should behave. The level control band (~44 to ~80) gives the pump plenty of room to run for a solid 25–50 minutes before needing to restart. Low mechanical stress, healthy motor life.

---

### Abnormal Event: Day 5 (Jan 5)

Starting around **04:17 AM**, the pump went into **rapid cycling (short cycling)** that lasted for the rest of the day:

- **216 total segments** that day (vs. ~42 on normal days)
- **174 of them under 2 minutes each** = 80% short cycling
- Pump toggled on/off every **40–105 seconds**
- Level got stuck in a narrow band of **76–79** (vs. normal 44–80)
- Pump ran ~80% of the day during this period

**What happened:**

At midnight, the pump was already cycling normally. Around 04:00 AM the pump turned on but the level was ~66 instead of the usual ~44. It ran for 17 minutes and reached ~79, then stopped. Instead of letting the level drop back down to 44, something changed — the pump began cycling every 40–100 seconds trying to hold level around 77. This is classic "hunting" or short cycling.

---

### What Should You Be Concerned About?

1. **Motor/starter wear on Jan 5.** Short cycling every 45 seconds puts extreme stress on the motor windings, starter contacts, and shaft. 174 such cycles in one day is significant. If this happened repeatedly, you'd want to replace the starter soon.

2. **Unknown root cause.** Something changed at ~04:00 AM on Jan 5. Possible causes:
   - A setpoint or control band was changed on the PLC (operator or schedule change)
   - Inflow rate increased, so the pump couldn't bring the level down to 44 — the controller tried "trimming" around 77
   - Pump performance degradation (wear, partial blockage)
   - Level sensor drift or noise

3. **No immediate danger.** The level never dropped below ~44 (tank wasn't in danger of running dry) and never exceeded ~81 (no overflow). The main risk is mechanical wear.

---

### Recommendations

1. **Check the PLC/control panel** for any setpoint changes on Jan 5 around 04:00 AM.
2. **Review shift logs** — was there a mode change, maintenance, or upstream inflow change?
3. **Inspect the pump** for any performance issues (impeller wear, partial blockage).
4. **Verify the level transmitter** (LIT-101) calibration.
5. **If a narrow band was intentionally set**, restore the wide band (~44 to ~80). Short cycling is bad practice for a pump of this duty.

---

I've saved the summary and two charts to `/out`:
- `/out/pump_analysis_summary.txt` — full written report
- `/out/pump_p101_11day_overview.png` — 11-day overview (level + pump status)
- `/out/pump_p101_day5_detail.png` — zoomed-in Day 5 showing the transition to rapid cycling
