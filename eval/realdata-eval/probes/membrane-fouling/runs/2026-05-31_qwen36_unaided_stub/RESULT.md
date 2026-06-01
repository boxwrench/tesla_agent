# RESULT

Numeric score: **FAIL/2**

The run correctly detected a strong fouling trend and passed the raw
DPIT slope, mean FIT, and fouling-boolean checks:

- `dpit_slope_per_day`: truth `1.6335`, answer `1.633513`
- `fit_mean`: truth `2.0999`, answer `2.0999`
- `fouling_detected`: truth `true`, answer `true`

It failed two numeric fields:

- `normalized_dpit_slope_per_day`: truth `0.3782`, answer `0.091852`
- `dpit_change_pct`: truth `78.16`, answer `87.5025`

The normalized-slope failure is a rubric-contract finding, not a clean
capability miss: `truth.json` uses the probe scorer's flow-normalized
definition (`DPIT / FIT^2` slope), but the prompt only asked for a
"normalized" slope and did not define that formula. The agent reported
a percent-of-mean-DPIT slope instead. Before using this probe for stack
comparisons, tighten the output contract or move the formula into an
allowed method layer.
