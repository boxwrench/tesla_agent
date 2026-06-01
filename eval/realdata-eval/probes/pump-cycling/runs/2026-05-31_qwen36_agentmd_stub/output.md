Here's the full picture from the 11-day dataset (Jan 1-11, 2026, 5-second samples, 190,080 rows).

---

P-101 / LIT-101 Pump Cycling Analysis -- Jan 1 to Jan 11, 2026

What the data tells me

1) Normal pump cycling logic -- looks healthy

The pump is filling the tank (level rises while P-101 is ON, drops while OFF):
  - P-101 turns ON when the level hits ~44-46% (low setpoint)
  - P-101 turns OFF when the level hits ~79-80% (high cutoff)
  - Normal run lasts ~30-40 minutes (median 49 minutes)
  - Normal idle lasts ~20-30 minutes (median 25 minutes)
  - The pump is ON 55.5% of the time overall

The ON/OFF transitions are clean and consistent -- no bounce or chatter. The level-at-OFF cutoff clusters tightly around 79-80% (std ~1.0%), and the level-at-ON setpoint clusters tightly around 44-46% for normal runs.

2) Monday morning forced runs -- stands out

Jan 5 (Monday) is the only anomalous day:
  - Between 04:00 and 07:00 AM, the pump cycles ON/OFF 90 times
  - Each "run" is only ~100-105 seconds (2 minutes), vs. the usual 30-50 min
  - Each "idle" gap is only ~35-40 seconds
  - These runs start at a HIGH level (~76-77%), not the normal low (~45%)
  - The level barely changes during these runs (only ~1-2% drop/rise)
  - Monday had 107 ON cycles vs. 20-21 on every other day

This looks like a scheduled forced/flush/top-up run programmed into the control logic. It happens on Mondays only, in the early morning window. Whether this is intended depends on your SOP -- the data itself shows nothing broken about these runs (consistent duration, consistent timing, consistent level range).

3) No alarms triggered, no excursions

  - Level stays between 43.9% and 81.3% across all 11 days
  - 99% of readings are within 44-81%
  - No samples beyond 3 standard deviations from the mean
  - No gaps or missing data in the historian record

Bottom line

The pump is operating normally on a daily basis. The high-level setpoint (~79-80%) and low-level setpoint (~44-46%) are clean and consistent. The only thing that jumps out is the Monday 04:00-07:00 forced cycling -- 90 very short on/off bursts at high level. If that's a planned schedule (flush, top-up, maintenance run), it's behaving as expected. If you don't know what it is, that's the thing to check with your controls engineer.

Charts saved to:
  /out/pump_cycling_overview.png  (full 11-day view)
  /out/monday_forced_runs.png    (zoomed Monday morning 03:00-09:00)
  /out/analysis_summary.txt      (text summary)
