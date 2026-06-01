# Probe: membrane-fouling

| | |
|---|---|
| **potable_category** | `filtration` |
| **Status** | scaffolded, scorer verified on stub |
| **Created** | 2026-05-31 |

## What It Tests

Whether the agent can separate a real filtration pressure-drop trend
from ordinary flow variation. The numeric target is a trend in
`DPIT-301`, checked both raw and flow-normalized against `FIT-301`.

## Inputs

| Item | Path |
|---|---|
| Stub data | `../../data/stubs/membrane_fouling_v1.parquet` |
| Real data slice | `../../data/real_slices/membrane_real_v1.parquet` — DPIT-301/FIT-301, 2015-12-29 00:00–06:00, carved from the full SWaT CSV via `scripts/make_real_slice.py` (gitignored; reproducible) |
| Ground truth (stub) | `truth.json` — seeded fouling (`fouling_detected: true`) |
| Ground truth (real) | `truth.real.json` — **cleaning-aware** (`build_truth.py --segment-cleanings`): segments the CIP cleanings out (10 found, 81.5% operating) and grades fouling on the **inter-clean steady trend** (0.65/day → `fouling_detected: true`). Replaces the naive single-line model that mis-graded this sawtooth window (see INSIGHTS #7). Gate on `fouling_detected`; derived metrics stay informational. |
| Canonical prompt | `prompt.md` |

`run_probe.sh --data stub` uses the stub; `--data real` uses the slice (wired via
`data_paths.sh`). Grade each against the matching truth file with
`score.py --truth <truth.json|truth.real.json>`.

The probe reuses the pump-cycling loader and integrity checker. That is
deliberate for now: probe #2 is testing the second operational question,
not a second copy of data-normalization machinery.

## Expected Agent Outputs

Each run should include:

- `output.md` — operator-facing brief
- `answers.json` — structured numeric answer for `score.py`

`answers.json` shape is documented in `prompt.md`.

## Scoring

`score.py` splits checks into two tiers (rubric-contract fix, 2026-05-31).

**Gating** — decides PASS/FAIL; all unambiguously defined:

- raw DPIT slope within 10% relative
- mean FIT within 5% relative
- fouling detected boolean exactly matches truth

**Informational** — computed and reported (surfaces in `score.json` as
`informational_divergence`) but does **not** fail the run, because the prompt
does not pin their definition:

- flow-normalized DPIT slope within 10% relative — `truth` normalizes as
  `DPIT/FIT**2`; the prompt does not say *how* to normalize, so an honest agent
  may report a different (e.g. relative) slope.
- DPIT start-to-end percent change within 5 pp — `truth` uses edge-median
  windows; an endpoint-to-endpoint reading is equally valid.

To promote either informational metric back to gating, first pin its definition
in `prompt.md` (then it is fair to score). The truth metrics are unchanged.
Recommendation text is human-graded separately. See `INSIGHTS.md` #3/#6.
