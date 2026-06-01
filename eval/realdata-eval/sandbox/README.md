# Agent sandbox — the standard toolbox

When the agent analyzes plant data it writes code and runs it in an
isolated Docker sandbox. That sandbox needs two things provisioned, or
the agent fails on environment rather than on reasoning (see Finding #1
in `../devlog.md`):

1. **The data** — mounted read-only at `/data` (via `docker_volumes`
   in `~/.hermes/config.yaml`).
2. **The tools** — a curated set of libraries baked into the image
   (`Dockerfile` here).

This is the "don't be too tough on the agent" principle: we want to
measure whether the model can *reason about plant data*, not whether it
can fight an empty environment. A real deployment would ship a
provisioned sandbox too — so provisioning one here is production-
faithful, not a thumb on the scale.

## The toolbox (and why each is in it)

Curated, justified — not a kitchen sink. An agent doing operational
water-treatment analysis should reasonably expect to have:

| Library | Why it's in the standard kit |
|---|---|
| **pandas** | Tables. The workhorse for any historian/CSV analysis. |
| **numpy** | Numerics underneath pandas; array math, thresholds, rolling logic. |
| **pyarrow** | Reads/writes Parquet (our stubs, and fast columnar historian dumps). |
| **scipy** | Signal processing + stats: smoothing, peak/edge detection, correlation, distributions — the math behind cycle/fouling/trend analysis. |
| **matplotlib** | Charts. An operator brief is far stronger with a trend plot than a wall of numbers. |
| **openpyxl** | Read/write Excel. Operators live in spreadsheets; data arrives and leaves as `.xlsx`. |
| **tabulate** | Clean text tables in the agent's written answer. |

## What is deliberately NOT here (yet)

Add with justification, don't pre-load speculatively:

- **statsmodels** — heavier regression/time-series; add when a probe
  actually needs ARIMA/seasonal decomposition.
- **scikit-learn** — ML/anomaly models; the SWaT literature uses them,
  but that's the *separate cyber project*, not operational analysis.
- **Database drivers** (psycopg, pyodbc) — add when a probe reads from
  a live historian instead of a file export.

## Maintaining this

- The toolbox is **code** (`Dockerfile`) — reproducible, reviewable,
  not a hand-edited container.
- Rebuild after changing it:
  `docker build -t hermes-realdata-eval:latest .`
- The build self-checks: it fails if any listed library won't import,
  so a broken toolbox never reaches an agent run.
- Keep the table above in sync with the Dockerfile.
