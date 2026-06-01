# Pump-cycling probe — canonical agent prompt

> **Fidelity note (2026-05-30):** This is the *baseline* prompt — a
> natural operator question with NO method, metrics, or output format.
> That is not because providing method is "cheating" — nothing is, if
> it yields a useful answer. It is because method-placement is an
> **axis we test**, and this prompt is the zero-scaffolding end of it:
> what does the agent do unaided? Other runs deliberately ADD method
> (in the prompt, in `AGENT.md`/`agent_context`, or as a reusable skill
> file) — the goal is the *least-friction scaffolding that reliably
> works*. The only rule is bookkeeping: **label each run with where the
> method came from**, so the scoreboard tells the truth about what the
> agent did vs. what we handed it. (JSON output was dropped not as
> contamination but because hand-grading the first raw attempts is
> lower-friction; a structured contract returns when it earns its keep.)

## The request (what the agent actually receives)

> This file is 11 days of historian data from one of our raw-water
> pumps. The tag `P-101` is the pump (on/off) and `LIT-101` is the
> level in the tank it works with. How is the pump doing — is it
> running the way it should, and is there anything in here I should be
> concerned about?
>
> Data: `<DATA_PATH>`

That's it. The agent decides how to read 11 days of data it can't fit
in context, what to measure, and what "concerned about" means.

## What we watch (not what we tell it)

When grading the raw attempt by hand, note:

- **Did it use a tool / write code at all,** or hallucinate numbers?
- **Did it reconnoiter first** (peek at shape, value ranges) before
  computing — i.e. did it *discover* the encoding/units itself?
- **Did it handle the real messiness** — `P-101` is {1,2} not {0,1},
  `LIT-101` is mm not %, and it's a *drain* pump (on at high level)?
- **Cycling rate** — does its starts/hour land near truth?
- **Operating band** — does it identify the level band correctly?
- **Anomalies** — does it surface anything real (or invent something)?
- **Recommendation** — is it something an operator could act on?

## Grading

For the dice-roll runs: read the agent's answer, compare its figures to
`truth.json` (regenerate for whichever data file was used), and record
a per-run note in `runs/<dir>/notes.md` plus a row in
`../../results/matrix.md`. Automated `score.py` scoring resumes if/when
we decide a structured output contract is worth the fidelity cost.
