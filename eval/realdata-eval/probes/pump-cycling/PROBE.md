# Probe: pump-cycling

| | |
|---|---|
| **potable_category** | `systems_integration_and_equipment_behavior` |
| **Status** | first stub runs graded |
| **Created** | 2026-05-30 |

## What it tests

Whether the agent can read 11 days of raw historian data for a single
tank+pump pair and produce an operator-facing characterization of pump
duty: cycle rate, control band, short-cycling pathology, and a useful
recommendation.

This is a "jar test" for the agent. The data is fixed, the right
answers are computable from the data, and the same probe runs over and
over while we vary model, prompt, strategy, or harness.

## Inputs

| Item | Path |
|---|---|
| Stub data (committed, deterministic) | `../../data/stubs/pump_cycling_v1.parquet` |
| Real SWaT data (gitignored) | `../../data/raw/SWaT_Dataset_Attack_v0.csv` |
| Normalizer (messy→canonical, incl. value layer) | `load.py` |
| Integrity / packing-slip check | `integrity.py` |
| Canonical prompt | `prompt.md` |
| Ground-truth (committed = stub) | `truth.json` (regenerable via `build_truth.py`) |

> **Real-data status (2026-05-30):** RESOLVED. `load.py` now normalizes
> both names AND values — real SWaT `P-101` {1=off,2=on} is mapped to
> canonical {0,1}, and `LIT-101` is handled in its native unit (mm vs
> percent auto-detected). `build_truth.py` runs `integrity.py` first
> and produces correct numbers on the real CSV (band 529–812 mm, drain
> pump, tol 14.17 mm). The committed `truth.json` is the **stub**
> answer key; regenerate against `data/raw/...` with `--data` for a
> real-data run. Band tolerance scales with the level unit; band edges
> are direction-agnostic (fill vs drain) with a `pump_action` field.

## Expected agent outputs

Each run dir holds two files written by the agent:

- `output.md` — operator-facing brief, prose
- `answers.json` — structured fields the scorer can grade

`answers.json` shape is documented in `prompt.md`.

## Scoring

`score.py` checks `answers.json` against `truth.json` with tolerances:

- starts-per-hour within **5 % relative**
- band low/high within **±2 % level** (absolute)
- each ground-truth short-cycle window overlaps at least one reported
  window (**±30 min slack**)

Recommendation paragraph is human-graded after the numeric pass.

## How to regenerate the ground-truth

```bash
python build_truth.py
# writes truth.json next to this file
```

If you change the stub seed or the synth_stub parameters, re-run this
before any new runs so the rubric matches the data.

## How to add a run

```bash
RUN=runs/$(date +%F)_<stack>_<strategy>
mkdir -p "$RUN"
# (agent invocation writes output.md + answers.json into $RUN)
python score.py --truth truth.json --answers "$RUN/answers.json" --out "$RUN/score.json"
```

Then append a row to `../../results/matrix.md`.

## Sister project tag

The `potable_category` field links this probe to
[potable](https://github.com/boxwrench/potable). potable authors
operator-reasoning examples in the same taxonomy; realdata-eval scores
the model on real instrument data in the same taxonomy. A probe the
model fails on points at a gap in potable coverage; a new batch of
potable training examples can be re-evaluated against this same probe
to measure improvement.
