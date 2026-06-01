# Session transcript (session_20260601_073244_25a3c6.json)

messages: 26 · assistant turns: 13 · tool-call turns: 12 · reasoning chars: 4059

## [1] assistant
Let me start by examining the data structure and then run a proper analysis.

## [1] assistant → tool
```
python3 -c "
import pyarrow.parquet as pq
t = pq.read_table('/data/stubs/ph_control_v1.parquet')
print('Schema:')
print(t.schema)
print()
print('Num rows:', t.num_rows)
"
```

## [2] tool output
```
{"output": "Schema:\nTimestamp: timestamp[us]\nAIT-202: float\nP-203: int8\n-- schema metadata --\npandas: '{\"index_columns\": [], \"column_indexes\": [], \"columns\": [{\"name\":' + 440\n\nNum rows: 10080", "exit_code": 0, "error": null}
```

## [3] assistant → tool
```
python3 -c "
import pandas as pd
df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

print('Rows:', len(df))
print('Time range:', df['timestamp'].min(), 'to', df['timestamp'].max())
print()
print('Ph stats:')
print(df['ph'].describe())
print()
print('Pump stats (0=off, 1=on):')
print(df['pump'].describe())
print()
print('First 5 rows:')
print(df.head())
print()
print('Last 5 rows:')
print(df.tail())
print()
print('Pump value counts:')
print(df['pump'].value_counts().sort_index())
print()
# Sample interval
print('Time delta between rows (median):', df['timestamp'].diff().dropna().median())
"
```

## [4] tool output
```
{"output": "Rows: 10080\nTime range: 2026-03-01 00:00:00 to 2026-03-07 23:59:00\n\nPh stats:\ncount    10080.000000\nmean         7.508974\nstd          0.276367\nmin          5.529179\n25%          7.512195\n50%          7.547772\n75%          7.582250\nmax          7.721493\nName: ph, dtype: float64\n\nPump stats (0=off, 1=on):\ncount    10080.000000\nmean         1.367361\nstd          0.482110\nmin          1.000000\n25%          1.000000\n50%          1.000000\n75%          2.000000\nmax          2.000000\nName: pump, dtype: float64\n\nFirst 5 rows:\n            timestamp        ph  pump\n0 2026-03-01 00:00:00  7.607839     2\n1 2026-03-01 00:01:00  7.554267     1\n2 2026-03-01 00:02:00  7.563419     2\n3 2026-03-01 00:03:00  7.595982     2\n4 2026-03-01 00:04:00  7.583668     1\n\nLast 5 rows:\n                timestamp        ph  pump\n10075 2026-03-07 23:55:00  7.488053     2\n10076 2026-03-07 23:56:00  7.552032     1\n10077 2026-03-07 23:57:00  7.492336     2\n10078 2026-03-07 23:58:00  7.482215     1\n10079 2026-03-07 23:59:00  7.516178     2\n\nPump value counts:\npump\n1    6377\n2    3703\nName: count, dtype: int64\n\nTime delta between rows (median): 0 days 00:01:00",
```

## [5] assistant → tool
```
python3 -c "
import pandas as pd
df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

# Check if pump values are truly binary and what they represent
print('Unique pump values:', sorted(df['pump'].unique()))

# Let's check the relationship between pump state and pH
# Try treating 1=off, 2=on
df['pump_on'] = (df['pump'] == 2).astype(int)
print()
print('Pump on (2) time:', df[df['pump_on']==1]['timestamp'].min(), '-', df[df['pump_on']==1]['timestamp'].max())
print()

# Duty cycle - how much time is pump 'on'
duty_pct = 100.0 * df['pump_on'].mean()
print(f'Duty cycle (pump=2): {duty_pct:.1f}%')

# If pump=1 is on instead:
df['pump_on_v2'] = (df['pump'] == 1).astype(int)
duty_pct_v2 = 100.0 * df['pump_on_v2'].mean()
print(f'Duty cycle (pump=1): {duty_pct_v2:.1f}%')

# Check pH when pump is at each state
print()
print('Ph stats when pump=1:')
print(df[df['pump']==1]['ph'].describe())
print()
print('Ph stats when pump=2:')
print(df[df['pump']==2]['ph'].describe())
"
```

## [6] tool output
```
{"output": "Unique pump values: [np.int8(1), np.int8(2)]\n\nPump on (2) time: 2026-03-01 00:00:00 - 2026-03-07 23:59:00\n\nDuty cycle (pump=2): 36.7%\nDuty cycle (pump=1): 63.3%\n\nPh stats when pump=1:\ncount    6377.000000\nmean        7.546168\nstd         0.049143\nmin         7.395607\n25%         7.511827\n50%         7.545483\n75%         7.579650\nmax         7.721493\nName: ph, dtype: float64\n\nPh stats when pump=2:\ncount    3703.000000\nmean        7.444921\nstd         0.444186\nmin         5.529179\n25%         7.513682\n50%         7.551652\n75%         7.586340\nmax         7.719762\nName: ph, dtype: float64", "exit_code": 0, "error": null}
```

## [7] assistant → tool
```
python3 -c "
import pandas as pd
import numpy as np

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

# Define pump 'on' as state 2
df['pump_on'] = (df['pump'] == 2).astype(int)

# Check for consecutive 'on' periods and their lengths
pump_changes = df['pump_on'].diff().fillna(0)
on_starts = df[pump_changes == 1].index.tolist()
on_ends = df[pump_changes == -1].index.tolist()

# Find all dosing events
dosing_events = []
current_start = None
for i in range(len(df)):
    if df['pump_on'].iloc[i] == 1 and (i == 0 or df['pump_on'].iloc[i-1] == 0):
        current_start = i
    elif df['pump_on'].iloc[i] == 0 and current_start is not None:
        duration = i - current_start
        dosing_events.append({'start_idx': current_start, 'end_idx': i-1, 'duration_min': duration})
        current_start = None

# Handle last event
if current_start is not None:
    duration = len(df) - current_start
    dosing_events.append({'start_idx': current_start, 'end_idx': len(df)-1, 'duration_min': duration})

print(f'Total dosing events: {len(dosing_events)}')
print()

# Check for pH excursions below 6.5 (common drinking water lower bound)
low_ph = df[df['ph'] < 6.5]
print(f'Minutes with pH < 6.5: {len(low_ph)} ({100*len(low_ph)/len(df):.1f}%)')
print()

# Check for pH excursions above 8.0
high_ph = df[df['ph'] > 8.0]
print(f'Minutes with pH > 
```

## [8] tool output
```
{"output": "Total dosing events: 2201\n\nMinutes with pH < 6.5: 207 (2.1%)\n\nMinutes with pH > 8.0: 0 (0.0%)\n\nSample low-pH readings (pH < 6.5):\n          timestamp       ph  pump  pump_on\n2026-03-05 00:16:00 6.498387     2        1\n2026-03-05 00:18:00 6.395335     2        1\n2026-03-05 00:19:00 6.333800     2        1\n2026-03-05 00:20:00 6.250525     2        1\n2026-03-05 00:21:00 6.182277     2        1\n2026-03-05 00:22:00 6.083348     2        1\n2026-03-05 00:23:00 6.024814     2        1\n2026-03-05 00:24:00 5.957531     2        1\n2026-03-05 00:25:00 5.867600     2        1\n2026-03-05 00:26:00 5.852603     2        1\n2026-03-05 00:27:00 5.796884     2        1\n2026-03-05 00:28:00 5.661687     2        1\n2026-03-05 00:29:00 5.705794     2        1\n2026-03-05 00:30:00 5.602646     2        1\n2026-03-05 00:31:00 5.613569     2        1\n2026-03-05 00:32:00 5.575182     2        1\n2026-03-05 00:33:00 5.549834     2        1\n2026-03-05 00:34:00 5.587347     2        1\n2026-03-05 00:35:00 5.579494     2        1\n2026-03-05 00:36:00 5.586558     2        1\nMinutes with pH change > 0.5: 0", "exit_code": 0, "error": null}
```

## [9] assistant → tool
```
python3 -c "
import pandas as pd
import numpy as np

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['pump_on'] = (df['pump'] == 2).astype(int)

# Analyze dosing event durations
pump_changes = df['pump_on'].diff().fillna(0)
on_starts = df[pump_changes == 1].index.tolist()
on_ends = df[pump_changes == -1].index.tolist()

# Build consecutive runs
runs = []
state = df['pump_on'].iloc[0]
run_start = 0
for i in range(1, len(df)):
    if df['pump_on'].iloc[i] != state:
        runs.append({'state': state, 'start': run_start, 'end': i-1, 'duration': i - run_start})
        state = df['pump_on'].iloc[i]
        run_start = i
runs.append({'state': state, 'start': run_start, 'end': len(df)-1, 'duration': len(df) - run_start})

dosing_runs = [r for r in runs if r['state'] == 1]
resting_runs = [r for r in runs if r['state'] == 0]

print(f'Dosing runs: {len(dosing_runs)}')
print(f'Resting runs: {len(resting_runs)}')
print()
print('Dosing run durations (min):')
dosing_dur = [r['duration'] for r in dosing_runs]
print(f'  min={min(dosing_dur)}, max={max(dosing_dur)}, median={np.median(dosing_dur):.0f}, mean={np.mean(dosing_dur):.1f}')
print()
print('Resting run durations (min):')
resting_dur = [r['duration'] for r in resting_runs]
print(f'  min={min(resting_dur)}, max={max(resting_dur)}, median={np.median(resting_dur):.0f}, mean={np.m
```

## [10] tool output
```
{"output": "Dosing runs: 2201\nResting runs: 2200\n\nDosing run durations (min):\n  min=1, max=242, median=1, mean=1.7\n\nResting run durations (min):\n  min=1, max=24, median=2, mean=2.9\n\nDosing run durations distribution:\n  1-2 min: 1420 runs\n  2-3 min: 494 runs\n  3-4 min: 172 runs\n  4-5 min: 70 runs\n  5-6 min: 27 runs\n  6-7 min: 6 runs\n  7-8 min: 4 runs\n  8-9 min: 6 runs\n  10-11 min: 1 runs\n\nResting run durations distribution:\n  1-2 min: 798 runs\n  2-3 min: 474 runs\n  3-4 min: 332 runs\n  4-5 min: 188 runs\n  5-6 min: 132 runs\n  6-7 min: 100 runs\n  7-8 min: 54 runs\n  8-9 min: 47 runs\n  9-10 min: 23 runs\n  10-11 min: 12 runs", "exit_code": 0, "error": null}
```

## [11] assistant → tool
```
python3 << 'PYEOF'
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['pump_on'] = (df['pump'] == 2).astype(int)

# Create a dual-axis chart: pH on left y-axis, pump on/off on right y-axis
fig, ax1 = plt.subplots(figsize=(16, 6))

# Subsample for readability - plot every 5th point
step = 5
ax1.plot(df['timestamp'][::step], df['ph'][::step], color='steelblue', linewidth=0.8, label='Process pH (AIT-202)')

ax1.fill_between(df['timestamp'][::step], 0, df['ph'][::step], color='steelblue', alpha=0.1)

# Add secondary axis for pump state
ax2 = ax1.twinx()
ax2.plot(df['timestamp'][::step], df['pump_on'][::step], color='darkred', linewidth=0.8, label='P-203 Pump (1=off, 2=on)', alpha=0.7)
ax2.set_ylim(0.5, 2.5)

# Add reference lines
ax1.axhline(y=6.5, color='red', linestyle='--', linewidth=1.5, alpha=0.7, label='Secondary standard lower bound (6.5)')
ax1.axhline(y=8.0, color='red', linestyle='--', linewidth=1.5, alpha=0.7, label='Secondary standard upper bound (8.0)')
ax1.axhline(y=df['ph'].mean(), color='green', linestyle=':', linewidth=1.0, alpha=0.5, label=f'Mean pH ({df["ph"].mean():.2f})')

ax1.set_xlabel('Date (Mar 2026)')
ax1.set_ylabel('pH', color='steelblue')
ax2.set_ylabel('P-203 Pump State', color='darkred')
```

## [12] tool output
```
{"output": "", "exit_code": -1, "error": "Foreground command uses '&' backgrounding. Use terminal(background=true) for long-lived processes, then run health checks and tests in follow-up terminal calls.", "status": "error"}
```

## [13] assistant → tool
```
cat > /tmp/analyze.py << 'PYEOF'
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['pump_on'] = (df['pump'] == 2).astype(int)

# Chart 1: Full overview
fig, ax1 = plt.subplots(figsize=(16, 6))

step = 5
ax1.plot(df['timestamp'][::step], df['ph'][::step], color='steelblue', linewidth=0.8, label='Process pH (AIT-202)')
ax1.fill_between(df['timestamp'][::step], 0, df['ph'][::step], color='steelblue', alpha=0.1)

ax2 = ax1.twinx()
ax2.plot(df['timestamp'][::step], df['pump_on'][::step], color='darkred', linewidth=0.8, label='P-203 Pump (2=on)', alpha=0.7)
ax2.set_ylim(0.5, 2.5)

ax1.axhline(y=6.5, color='red', linestyle='--', linewidth=1.5, alpha=0.7, label='Secondary std lower bound (6.5)')
ax1.axhline(y=8.0, color='red', linestyle='--', linewidth=1.5, alpha=0.7, label='Secondary std upper bound (8.0)')
ax1.axhline(y=df['ph'].mean(), color='green', linestyle=':', linewidth=1.0, alpha=0.5, label='Mean pH ({:.2f})'.format(df['ph'].mean()))

ax1.set_xlabel('Date (Mar 2026)')
ax1.set_ylabel('pH', color='steelblue')
ax2.set_ylabel('P-203 Pump State', color='darkred')
ax1.set_ylim(5.2, 8.2)
ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
ax1.xaxis.set_major_locator(md
```

## [14] tool output
```
{"output": "", "exit_code": -1, "error": "Foreground command uses '&' backgrounding. Use terminal(background=true) for long-lived processes, then run health checks and tests in follow-up terminal calls.", "status": "error"}
```

## [15] assistant → tool
```
cat > /tmp/analyze.py << 'ENDSCRIPT'
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['pump_on'] = (df['pump'] == 2).astype(int)

fig, ax1 = plt.subplots(figsize=(16, 6))
step = 5
ax1.plot(df['timestamp'][::step], df['ph'][::step], color='steelblue', linewidth=0.8)
ax1.fill_between(df['timestamp'][::step], 0, df['ph'][::step], color='steelblue', alpha=0.1)

ax2 = ax1.twinx()
ax2.plot(df['timestamp'][::step], df['pump_on'][::step], color='darkred', linewidth=0.8, alpha=0.7)
ax2.set_ylim(0.5, 2.5)

ax1.axhline(y=6.5, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
ax1.axhline(y=8.0, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
ax1.axhline(y=df['ph'].mean(), color='green', linestyle=':', linewidth=1.0, alpha=0.5)

ax1.set_xlabel('Date (Mar 2026)')
ax1.set_ylabel('pH', color='steelblue')
ax2.set_ylabel('P-203 Pump')
ax1.set_ylim(5.2, 8.2)
ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
ax1.xaxis.set_major_locator(mdates.HourLocator(interval=6))
fig.autofmt_xdate()
plt.title('pH Control Overview - 7 Day Window')
plt.tight_layout()
plt.savefig('/out/ph_control_overview.png', dpi=150)
plt.close()
print('Saved overview chart')

low_ph_window = df[df
```

## [16] tool output
```
{"output": "", "exit_code": -1, "error": "Foreground command uses '&' backgrounding. Use terminal(background=true) for long-lived processes, then run health checks and tests in follow-up terminal calls.", "status": "error"}

[Tool loop warning: same_tool_failure_warning; count=3; terminal has failed 3 times this turn. This looks like a loop; change approach before retrying.]
```

## [17] assistant
Let me write the script using the write_file tool instead.

## [17] assistant → tool
```
python3 -c "
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['pump_on'] = (df['pump'] == 2).astype(int)

fig, ax1 = plt.subplots(figsize=(16, 6))
step = 5
ax1.plot(df['timestamp'][::step], df['ph'][::step], color='steelblue', linewidth=0.8)
ax1.fill_between(df['timestamp'][::step], 0, df['ph'][::step], color='steelblue', alpha=0.1)
ax2 = ax1.twinx()
ax2.plot(df['timestamp'][::step], df['pump_on'][::step], color='darkred', linewidth=0.8, alpha=0.7)
ax2.set_ylim(0.5, 2.5)
ax1.axhline(y=6.5, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
ax1.axhline(y=8.0, color='red', linestyle='--', linewidth=1.5, alpha=0.7)
ax1.axhline(y=df['ph'].mean(), color='green', linestyle=':', linewidth=1.0, alpha=0.5)
ax1.set_xlabel('Date (Mar 2026)')
ax1.set_ylabel('pH')
ax2.set_ylabel('P-203 Pump')
ax1.set_ylim(5.2, 8.2)
ax1.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
ax1.xaxis.set_major_locator(mdates.HourLocator(interval=6))
fig.autofmt_xdate()
plt.title('pH Control Overview - 7 Day Window')
plt.tight_layout()
plt.savefig('/out/ph_control_overview.png', dpi=150)
plt.close()
print('Saved overview chart')

low_ph_window = df[df['ph'] < 6.5].iloc[:50]
if len(low_ph_window) 
```

## [18] tool output
```
{"output": "Saved overview chart\nSaved detail chart", "exit_code": 0, "error": null}
```

## [19] assistant
Charts saved. Now let me compute the final numbers and write the answers.json.

## [19] assistant → tool
```
python3 -c "
import pandas as pd
import numpy as np

df = pd.read_parquet('/data/stubs/ph_control_v1.parquet')
df.columns = ['timestamp', 'ph', 'pump']
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)

ph_mean = round(float(df['ph'].mean()), 4)
ph_min = round(float(df['ph'].min()), 4)
ph_max = round(float(df['ph'].max()), 4)

pump_on = (df['pump'] == 2).astype(int)
duty_pct = round(float(100.0 * pump_on.mean()), 2)

# Control fault: multiple criteria
# 1) Pump cycling 2201 times in 7 days = ~47 events/day = ~every 30 min on average
# 2) 207 minutes of pH below 6.5
# 3) Min pH 5.53 (dangerously low)
# 4) Median dosing run = 1 minute (bang-bang chattering)
low_ph_count = len(df[df['ph'] < 6.5])
fault_reasons = []

if low_ph_count > 0:
    fault_reasons.append('pH dropped below 6.5 for {} minutes ({:.1f}% of window)'.format(low_ph_count, 100*low_ph_count/len(df)))

# Check pump cycling frequency
pump_diffs = df['pump'].diff().fillna(0)
toggles = (pump_diffs != 0).sum()
fault_reasons.append('Pump toggled {} times in 7 days (~{:.0f} events/day)'.format(toggles, toggles/7))

# Check for overshot
if ph_min < 6.5:
    fault_reasons.append('Minimum pH = {} (below 6.5 drinking-water secondary standard)'.format(ph_min))

print('ph_mean:', ph_mean)
print('ph_min:', ph_min)
print('ph_max:', ph_max)
print('duty_pct:', duty_pct)
print('pump_on_pct:', duty_pct)
print('low_ph_minutes:', low_ph_count)
print('toggles:', int(toggles))
prin
```

## [20] tool output
```
{"output": "ph_mean: 7.509\nph_min: 5.5292\nph_max: 7.7215\nduty_pct: 36.74\npump_on_pct: 36.74\nlow_ph_minutes: 207\ntoggles: 4400\nfault_reasons: ['pH dropped below 6.5 for 207 minutes (2.1% of window)', 'Pump toggled 4400 times in 7 days (~629 events/day)', 'Minimum pH = 5.5292 (below 6.5 drinking-water secondary standard)']\ncontrol_fault_detected: True", "exit_code": 0, "error": null}
```

## [21] assistant → tool
```
python3 -c "
import json

answer = {
    'ph_mean': 7.509,
    'ph_min': 5.5292,
    'ph_max': 7.7215,
    'dosing_duty_pct': 36.74,
    'control_fault_detected': True
}

with open('/out/answers.json', 'w') as f:
    json.dump(answer, f, indent=2)

print('Saved /out/answers.json')
print(json.dumps(answer, indent=2))
"
```

## [22] tool output
```
{"output": "Saved /out/answers.json\n{\n  \"ph_mean\": 7.509,\n  \"ph_min\": 5.5292,\n  \"ph_max\": 7.7215,\n  \"dosing_duty_pct\": 36.74,\n  \"control_fault_detected\": true\n}", "exit_code": 0, "error": null}
```

## [23] assistant → tool
```
ls -la /out/
```

## [24] tool output
```
{"output": "total 336\ndrwxrwxrwx 2 pn   pn     4096 Jun  1 14:35 .\ndrwxr-xr-x 1 root root   4096 Jun  1 14:32 ..\n-rw-r--r-- 1 root root    124 Jun  1 14:35 answers.json\n-rw-r--r-- 1 root root 274222 Jun  1 14:35 ph_control_overview.png\n-rw-r--r-- 1 root root  53729 Jun  1 14:35 ph_excursion_detail.png", "exit_code": 0, "error": null}
```

## [25] assistant
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

