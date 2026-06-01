All files are saved. Here is the operator-facing summary.

---

OPERATOR SUMMARY -- pH Control, Stage 2 Chemical Dosing
Window: 2026-03-01 00:00 through 2026-03-07 23:59 (7 days, 1-minute intervals)

Is the pH under control?
------------------------
No. The loop is clearly in a **bang-bang (on/off) cycling** mode with no
evidence of proportional (modulating) control. The pump P-203 is chattering
-- it toggled about 4,400 times in 7 days (roughly 629 events/day, or about
one cycle every ~2 minutes on average). That level of cycling is a control
fault and will wear out the pump actuator well before its design life.

What to be concerned about
--------------------------
1. pH excursions below 6.5 (drinking-water secondary standard per 40 CFR
   143.61). There were 207 minutes (2.1% of the window) where pH dropped
   below 6.5, with an absolute minimum of 5.53 recorded on March 5 around
   00:27-00:35.

2. The acid pump is dosing in very short bursts (median dosing run = 1
   minute, median off-run = 2 minutes). This suggests the controller is
   either a simple on/off relay with a very tight deadband or the PID
   gains are wildly excessive, causing the pump to "hunt."

3. When the pump is off, pH is rock-stable (std dev 0.05). When it is on,
   pH swings much more (std dev 0.44), and the acid is over-dosing relative
   to the incoming alkalinity, driving pH below acceptable range.

4. 36.7% duty cycle is high for a simple on/off loop. If this were a
   properly tuned proportional controller, you would expect smoother
   modulation, not 2,200 discrete on/off events per week.

Recommended actions
-------------------
- Verify whether the controller on the PLC/SCADA is configured in ON/OFF
  mode or in proportional (PID) mode. If ON/OFF, consider switching to
  PID with a tuned output (0-100% modulation) rather than discrete on/off.
- Check the pump actuator / motor for signs of excessive cycling (heat,
  contactor chatter, early wear).
- Review the acid set-point and deadband. The mean pH of 7.51 is reasonable,
  but the tight cycling and deep excursions suggest the deadband is too
  narrow or the pump sizing is too aggressive for the flow/alkalinity load.
- Inspect the pH probe (AIT-202) for drift or fouling -- the 2.2-unit peak-to-peak
  range (5.53 to 7.72) is wider than expected for a well-controlled stage-2
  dosing loop.

Supporting files
----------------
- /out/answers.json          (numeric summary, JSON)
- /out/ph_control_overview.png       (full 7-day overview chart)
- /out/ph_excursion_detail.png       (zoomed-in view of the worst excursion around Mar 5)
