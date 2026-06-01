# realdata-eval

**Evaluating the local agent on open-source plant data.**

This project gives the local agent a fixed library of *real* plant
instrument data — borrowed from open-source testbeds, not from any
client facility — and asks it the kinds of operational questions a
treatment operator would ask. Every question (a "probe") has a known
right answer, so we can re-run the same question over and over while
varying model, prompt, or strategy, and compare.

> 📋 **Start with the field report:** [**REPORT.md**](REPORT.md) — *Working
> With a Local Agent on Real Plant Data.* A two-layer write-up (operator
> verdict over expert evidence) of whether the local agent actually works
> on real plant data, across three problem types, with the prompts, the
> agent's own output, and an honest account of where it stumbled and what
> we changed. Every claim links to a run directory in `probes/*/runs/`.

## What's a probe?

A **probe** is one repeatable test you can run against the agent.

Think of it as a jar test:

- A **known sample** — an input data file with seeded characteristics
- A **question** — the canonical prompt we send to the agent
- A **known right answer** — computed deterministically from the data
- A **scorer** — grades the agent's output against the answer
- A **run** — one invocation with this model + this prompt + this
  data on this date, with all artifacts captured in a dated subdir

Probes are written once and re-run many times. The deliverable of this
project is not any single agent output — it's the rolled-up scoreboard
(`results/matrix.md`) across all probes and all runs.

> **Lessons so far:** see [`INSIGHTS.md`](INSIGHTS.md) — a curated,
> teaching-oriented collection of the transferable findings (a benchmark
> number physics says is impossible; why decode speed didn't pick the
> winner; "detected ≠ diagnosed"; and how the *same* model went from
> INVALID to PASS on a one-integer config change). Written for reuse in
> explainers and the teaching/potable side.

## Sister projects

- **[potable](https://github.com/boxwrench/potable)** — the *teaching*
  side. Expert-authored operator-reasoning examples in 16 categories,
  fine-tuning data for water-treatment models. realdata-eval examines
  the model; potable teaches it. Both use the same taxonomy so probe
  results and training coverage line up by category.
- **`qwen-tool-calling`** (sibling project in this repo) — the
  *gating* side. Validates that a given model can actually do reliable
  tool calls before we bother running it against real data here.

## Layout

```
realdata-eval/
├── README.md            ← this file
├── GLOSSARY.md          ← plain-language terms for this project
├── plan.md              ← design doc, axes, success criteria
├── devlog.md            ← append-only running log
├── data/
│   ├── README.md        ← provenance + citation
│   ├── raw/             ← gitignored, full mirrored datasets
│   └── stubs/           ← synthetic data we generate; committed
├── probes/
│   └── pump-cycling/    ← first probe
│       ├── PROBE.md     ← spec
│       ├── prompt.md    ← canonical prompt sent to the agent
│       ├── truth.json   ← ground-truth answers
│       ├── build_truth.py
│       ├── score.py
│       └── runs/        ← per-run dirs: input, output, score, notes
├── scripts/
│   ├── fetch_mirror.sh  ← pulls open datasets into data/raw/
│   ├── synth_stub.py    ← generates deterministic stub data
│   └── run_probe.sh     ← one-command probe driver
└── results/
    └── matrix.md        ← scoreboard across all runs
```

## Status

- **2026-05-31** — first **pump-cycling** stub runs completed. Gemma
  31B (dense) graded `FAIL/1` — missed the seeded short-cycle window.
  Qwen 3.6 35B MoE first hit a turn-cap harness fault (`INVALID`);
  after raising the cap and adding session-JSON capture, the **fair
  re-run graded `PASS/1`** — it named the short-cycling Gemma missed.
  So the *faster* MoE took more tool rounds but reached the *right*
  diagnosis. Probe #2, **membrane-fouling**, is built with stub +
  real-slice truth verification and pass/fail scorer smoke. See
  `devlog.md` and [`INSIGHTS.md`](INSIGHTS.md).

## Conventions

- **Operational analysis only.** Cyber/attack-detection framings of
  the same datasets belong to a separate project — parked notes at
  `../../../agent-workdir/notes/swat-analysis-ideas.md`.
- **Citation honored.** Any external publication derived from this
  work credits iTrust, SUTD per the SWaT dataset access agreement.
- **One axis varies per run dir.** Same probe, same data, change one
  thing, get a comparable score.
- **Glossary-as-you-go.** Any term that comes up in discussion or in a
  doc here should be lookup-able in [GLOSSARY.md](GLOSSARY.md). If you
  have to ask "what is that?", it belongs in the glossary — add it.
