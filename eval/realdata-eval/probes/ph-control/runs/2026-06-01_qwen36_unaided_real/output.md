Here's the operator-facing analysis.

---

**Stage 2 pH Control -- 2015-12-28, 10:00 to 20:00**

**Is the pH under control? No. There is a control fault.**

Summary of what the data shows (1 Hz sampling, 36,001 data points, 10-hour window):

* Average pH (AIT-202): **8.37**
* pH range: **6.00 to 8.47**
* Acid pump (P-203) duty cycle: **74.25 %** (ON 26,732 s, OFF 9,269 s)

**The fault: pH dropped to 6.00 at 12:00:33 for 199 seconds (3 min 19 s).**

How it happened:

1. The acid pump was ON (state=1) and pH was holding steady around 8.37.
2. At **12:00:33** the pump switched OFF (state=0). The pH did not recover or hold -- it immediately bottomed out at **6.00**.
3. The pump came back ON at **12:03:51** and pH returned to the normal ~8.37 range.
4. For the remaining ~8 hours the pump cycled normally with no further excursions.

Why this matters:

* pH 6.00 is well below any drinking-water discharge limit (typical range 6.5-8.5). A full 3-min window at 6.00 could mean untreated acid was reaching the distribution line or a downstream process.
* The pump turning OFF while pH was still ~8.37 is suspicious. Normally you would expect a controller to keep the pump running until pH rises to a setpoint. Either the controller logic had a gap, a fault override was applied, or the pump command was lost.
* After the pump came back on, the pH climbed back up normally, so the dosing chemistry itself appears sound. The root cause is a **control-system or pump-signal fault**, not a reagent problem.

**Recommendation:**

* Investigate what triggered the pump-OFF command at 12:00:33 -- check PLC logic, operator overrides, or interlocks that were active at that time.
* Review whether the pH controller had a fail-safe that should have kept the pump running when pH was rising or unstable.
* Check if this was an isolated event or if similar pump-OFF excursions appear in other data slices.

Supporting charts saved to `/out/`:
* `/out/ph_control_analysis.png` -- full 10-hour view with pH trace and pump state overlay
* `/out/ph_control_excursion_zoom.png` -- zoomed-in 16-min window centered on the fault

Numerical results:

```json
{
  "ph_mean": 8.37,
  "ph_min": 6.0,
  "ph_max": 8.4708,
  "dosing_duty_pct": 74.25,
  "control_fault_detected": true
}
```
