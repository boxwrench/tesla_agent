# Working With a Local Agent on Real Plant Data — a field report

*Status: 2026-06-01 · evidence through the 2026-06-01 reliability batch · author:
Keith + Claude (Opus 4.8)*

> **What this is.** Not a product pitch. It's a field report for an operator or
> engineer deciding whether — and *how* — to let a local AI agent help with plant
> data. We show what the agent receives, what it produces, where it does sound
> work, and just as carefully **where it stumbled and what we changed in
> response.** The honest failures are the most useful part: they're the things
> you'd otherwise discover the hard way.

---

## Layer 1 — The short answer

**A local agent can do real, sound analytical work on real plant data — fully
on your own hardware, with nothing leaving the machine — and it's reliable enough
to be a genuinely useful assistant, provided a human reads the output.**

It is **not** an unsupervised operator, and one field of one run is not gospel.
The skill in using it is knowing which parts to trust hard (the analysis and the
numbers) and which to read with judgment (a forced yes/no on a borderline call).

| | |
|---|---|
| **What works well** | Reads data itself, writes and runs its own analysis code, adapts when the data surprises it, reproduces ground-truth numbers to several significant figures, writes a clear operator brief. |
| **What you supervise** | A single boolean verdict on a borderline case can flip between runs; a run that ends mid-action can carry a half-finished number. The *reasoning* is steadier than the *one-bit summary*. |
| **Fully local?** | **Yes, by construction** — local model, local data, local sandbox, no network path off the box (verified below). |

The rest of this report is the evidence, the verbatim prompt and output, and the
"we tried X, saw Y, fixed Z" history.

---

## Layer 2 — The walkthrough

### A. The scenario

A stage-3 membrane filter has two instruments logging once a second: a
differential-pressure transmitter (`DPIT-301`, the trans-membrane pressure that
climbs as the membrane fouls) and a flow meter (`FIT-301`, permeate flow). An
operator has a six-hour slice of real data — this is an actual window from the
public SWaT water-treatment testbed — and one plain question:

> *"Is this membrane fouling in a way I should act on?"*

That's it. No formulas, no "compute the slope," no hint that the data contains
cleaning cycles. Exactly the under-specified way a real question arrives on the
plant floor.

### B. What the agent receives (verbatim)

The agent is handed a capability preamble (what tools it has) and the operator's
question — **and nothing about method.** This is the actual prompt sent:

```text
You are an engineering assistant supporting drinking-water treatment
operators. You help interpret plant data and answer operational
questions in plain, operator-facing language.

You have a terminal tool that runs commands in a sandboxed Linux
environment with Python 3.11. ... datasets are typically far too large
to read directly, so write and run code to examine and analyze them.

The sandbox has this toolbox preinstalled:
- pandas, numpy — tables and numerics
- pyarrow — Parquet files
- scipy — signal processing and statistics
- matplotlib — charts
  ...
Plant data is mounted read-only at /data. ... save [outputs] to /out ...

I have a historian slice at /data/real_slices/membrane_real_v1.parquet with
stage-3 membrane/filter instruments DPIT-301 and FIT-301.

Please assess whether this window shows a fouling trend that would matter
operationally. Write a short operator-facing answer and save any supporting
chart to /out.

Also provide /out/answers.json with this shape:
{ "dpit_slope_per_day": 0.0, "normalized_dpit_slope_per_day": 0.0,
  "fit_mean": 0.0, "dpit_change_pct": 0.0, "fouling_detected": true }
```

The only thing besides the question is a *structured-output contract* (the JSON
shape) so a machine can grade the answer. **Telling it what fields to return is
not the same as telling it how to compute them** — it still has to decide what
"fouling" means and how to measure it on this data.

### C. What the agent does (verbatim)

It runs a genuine agentic loop — explore, react to what it finds, dig deeper,
then synthesize. The pivotal moment: a few turns in, its own diagnostic output
surprised it. Sampling every 30 minutes, it printed (real tool output):

```text
2015-12-29 00:20:00 -> DPIT=19.838, FIT=2.213
2015-12-29 00:25:00 -> DPIT=17.008, FIT=2.264
...
2015-12-29 00:55:00 -> DPIT=1.972,  FIT=0.000   <-- pressure & flow collapse
2015-12-29 01:00:00 -> DPIT=1.962,  FIT=0.000
2015-12-29 01:05:00 -> DPIT=9.693,  FIT=2.248   <-- recovering
```

Nobody told it the data had cleaning cycles. It *found* them — pressure and flow
crashing to zero and recovering, periodically — and on the very next turn changed
its own method to exclude them:

```python
# Filter to normal operating periods: DPIT > 15 and FIT > 1.5
normal = df[(df['DPIT-301'] > 15) & (df['FIT-301'] > 1.5)].copy()
```

That is the signature of real inference: it reacted to its own intermediate
result, not a fixed plan. It then fit the fouling trend on the *clean* operating
data only, and wrote this operator brief (verbatim, lightly trimmed):

> **Operator Assessment: Stage-3 Membrane Differential Pressure (DPIT-301)**
> **Bottom line: No operational fouling detected in this window.**
>
> 1. DPIT-301 during normal operation (17,461 of 21,601 points) sits ~19.7–20.3.
>    Over the 6-hour window it rose from 19.91 to 20.13 — a 1.1% increase. The
>    linear trend is +0.78/day, but R² is only 0.053 — the trend explains almost
>    none of the variation.
> 2. Flow (FIT-301) is stable at 2.21, no drift.
> 3. 10 transient events where DPIT dropped to near-zero — likely scheduled
>    clean-in-place / backwash cycles, not fouling. DPIT recovers after each.
>
> **What to watch:** the slight upward drift is worth monitoring over 24–48 h, but
> does not warrant a cleaning or alarm now. If DPIT keeps climbing, a backwash may
> be needed in 2–3 days.

That is a sound, appropriately hedged plant assessment — and the agent reached it
unaided.

### D. Is the inference accurate?

We grade the agent's emitted numbers against a deterministic ground truth it
never sees. On the **synthetic stub** (a clean fouling ramp with a known answer),
the agent doesn't just "pass" — it reproduces the truth to four significant
figures, every roll:

| Probe / roll | metric | truth | agent | rel-error |
|---|---|---|---|---|
| membrane stub r1 | DPIT slope/day | 1.6335 | 1.633513 | **0.0000** |
| membrane stub r2 | DPIT slope/day | 1.6335 | 1.6335 | **0.0000** |
| membrane stub r3 | DPIT slope/day | 1.6335 | 1.633513 | **0.0000** |
| membrane stub (all) | mean flow | 2.0999 | 2.0999 | **0.0000** |
| membrane **real** rel1 | mean flow | 2.2086 | 2.2131 | 0.0020 (0.2%) |
| membrane **real** rel3 | mean flow | 2.1488* | — | ~3% |

\*real-data slope is reported as steady-state (inter-clean), which is the *more*
correct quantity than the whole-window figure our first truth used — see §F.

On clean data the inference is essentially exact. On messy real data the
continuous numbers (mean flow, slope) stay close; the place it gets interesting is
the single yes/no verdict — next section.

### E. Does it break? (reliability)

We fired the real-data probe repeatedly at **sole-consumer GPU** (no other job
sharing the chip — see §F on why that matters) and asked a blunt question: did it
complete and produce a gradeable answer?

| Run | exit | elapsed | turns | gradeable answer? |
|---|---|---|---|---|
| real cleanrun (05-31) | 0 | 204s | 10 | yes |
| real rel1 (06-01) | 0 | 209s | 12 | yes |
| real rel2 (06-01) | 0 | 330s | 12 | yes (but truncated — see §F) |
| real rel3 (06-01) | 0 | 185s | 11 | yes |

**4 / 4 completed at exit 0 with a gradeable answer, zero crashes.** Reliability,
in the sense of "it runs to completion and hands you something," is solid once the
known failure causes (below) are removed. The aggregator that builds this table is
`scripts/report_tables.py` — re-run after any batch.

But "completed" is not "every field correct." Here is the honest part.

### F. Where it didn't work — and what we changed

This is the section worth your time. Each item is something we *saw the agent or
the rig do wrong*, what it taught us, and the fix. (Full write-ups in
`INSIGHTS.md`.)

**1. We strangled a capable model with a turn limit — and blamed the model.**
Our first real MoE run flailed for 20 tool calls and never wrote a report. It
looked incompetent. It wasn't: our harness capped agent loops at 20, and this
model *explores first, synthesizes last* — the cap guillotined it mid-exploration.
We raised the cap 20→90 and the identical model walked the same path to a clean
PASS. **Lesson:** an agent score is the model *plus your scaffolding*; a failure is
a hypothesis to test, not a verdict. (INSIGHTS #4)

**2. We benchmarked while another job used the GPU — and got a corrupt, crashing
run.** One real run decoded at 20 tok/s instead of 54 because a second workload was
sharing the single APU's memory bandwidth. It ran to the edge of its timeout and
crashed mid-answer, emitting a garbled `answers.json` (a −7.5 slope). **Lesson:**
this box is a single LLM consumer; timing measured under contention measures two
workloads, not one. **Fix:** a sole-consumer-GPU rule for all benching — and it's
why every reliable run above is clean. (INSIGHTS #8)

**3. The agent out-reasoned our ground truth — twice.** Our first real-data
"truth" fit one straight line across the whole window. But real membrane data is a
*sawtooth* (pressure climbs, a cleaning cycle crashes it, repeat) — a single line
is meaningless on it. The agent, unprompted, **segmented the cleaning cycles** and
fit the steady inter-clean trend, which is exactly what an engineer evaluates. We
fixed our truth to match — and the *next* clean run exposed a second naivety: our
truth called "fouling" on a bare slope threshold, while the agent correctly judged
the trend noise-level (R²=0.05) and declined. We added a significance + horizon
gate (slope **and** R² **and** absolute rise **and** a minimum time window).
**Lesson:** when a good agent disagrees with your rubric, the rubric might be
wrong — especially on real data. A clean synthetic stub hides this forever because
truth and data share the same simple shape. (INSIGHTS #7)

**4. The analysis was reproducible; the one-bit verdict was not.** Across four
real rolls the agent did the *same sound analysis* every time (found the
cleanings, slope 0.63–0.78/day, R²≈0.05, "6 h is too short") — but the boolean
`fouling_detected` came out **false, false, true, true.** A coin flip. The tell:
roll rel3 wrote *"Do not trigger maintenance based on this 6-hour slice alone;
confirm over at least 48 h"* and **still set the flag to `true`** — its own
boolean contradicted its own narrative. **Lesson:** on a genuinely borderline
window, the *forced binary* is the least reliable thing on the page; the narrative
is far steadier. Read the prose; don't reduce a borderline call to one bit and
trust it blind. And the real fix for a flapping verdict is usually a *better
question* — here, a longer data window — not a better prompt. (INSIGHTS #9)

**5. A run that ends on an action can hand you a half-finished number.** Roll rel2
ended on a tool call ("Now let me create the charts…") instead of a final
synthesis. The harness recovered an answer, but a truncated one whose mean flow
(1.84) was the *unfiltered* average — it never finished excluding the cleaning
zeros (correct value 2.21). It completed, it was gradeable, but the number was
wrong because the synthesis didn't finish. **Lesson:** exit-0 completion is
necessary, not sufficient; sanity-check that the reported numbers came from the
*finished* analysis. **Mitigation already in the rig:** the harness recovers the
answer from the session log when stdout is empty, so these runs are captured and
inspectable rather than lost. (INSIGHTS #9)

The pattern across all five: **the agent's analytical reasoning is the strong,
trustworthy part; the failures cluster at the edges — provisioning, contention,
rubric assumptions, forced binaries, and truncated endings — and each is
understandable and manageable once named.**

### F2. The scenario a domain expert could check by eye — pH control

The membrane work above has one honest weakness: the reader (and the project
owner) has to take the membrane math somewhat on faith. So we added a third probe
in a field a drinking-water operator knows cold — **pH / acid-dosing control** —
specifically so an expert could *audit the agent's reasoning directly* instead of
trusting our grading. This is a different reasoning task again: not event-detection
(pumps) or trend-fitting (membranes) but **control-loop tracking** — is the
controlled variable holding its band against its actuator?

The agent received the usual de-leaked question — *"Is the pH being held under
control here, or is there anything I should be concerned about?"* — plus the pH
tag (`AIT-202`) and the acid pump (`P-203`). No band, no method. The trap was
deliberate: real plant pH runs **alkaline, ~8.4**, so an agent that assumed a
textbook [6.5, 8.5] band would wrongly flag the *normal* baseline as a problem.

It didn't take the bait. It established ~8.37 as the operating point, never flagged
it, and instead found the real event — verbatim from its brief:

> **Is the pH under control? No. There is a control fault.**
> The acid pump (P-203) switched OFF at 12:00:33; pH did not hold — it bottomed
> out at **6.00** — and the pump came back ON at 12:03:51, after which pH returned
> to ~8.37. … The pump turning OFF while pH was still ~8.37 is suspicious … The
> root cause is a **control-system or pump-signal fault, not a reagent problem.**
> *Recommendation: investigate the PLC logic / interlocks active at 12:00:33; check
> whether this recurs in other slices.*

**Then it disagreed with our ground truth — and the expert ruled for the agent.**
Our rubric required an excursion to last ≥30 minutes to count as a fault, so it
scored this self-recovering 3-minute dip as *no fault*. The agent called it a fault.
The operator's judgment: **a 3-minute slug of pH-6.0 water reaching distribution is
a real water-quality event regardless of duration** — the agent was right. We had
conflated two different things: "the loop drifted off setpoint" (which legitimately
must be sustained) and "out-of-spec water happened" (which does not). We fixed the
truth to fire on *either* a sustained drift **or** an acute breach of a fixed
regulatory limit (pH outside 6.5–9.0), and agent and truth now agree.

This is the campaign's **fourth** time the agent exposed a flaw in our ground
truth on real data — and the **first one adjudicated by a domain expert** rather
than inferred by us. For anyone deciding whether to trust a tool like this, that's
the most reassuring kind of evidence there is: not "we graded it and it passed,"
but "an expert checked the one case they could judge by eye, the tool disagreed
with the answer key, and the tool was right."

### G. Is it really local? (verified, and hardened so it can't drift)

- **Data** never leaves the box: mounted read-only at `/data`, every tool call is
  a local file read. Zero network I/O in the analysis.
- **Model** is a local `llama-server` (Qwen 3.6 35B-A3B) at `127.0.0.1:8095`.
  Per-run proof: each `meta.txt` carries a local llama.cpp decode/prefill timing
  stamp a cloud API can't produce.
- **Hardened (2026-06-01):** the eval profile previously had a *cloud fallback*
  with a live API key — a latent path off-box. For benching we pinned the fallback
  to the same local endpoint and removed the key, so **a bench run has no
  structural path off the machine.** (Personal config preserved in backups.)

### H. How to actually work with it (the takeaways)

1. **Trust the analysis; supervise the verdict.** The numbers and the reasoning
   are reproducible and accurate; a lone yes/no on a borderline case is not. Read
   the brief.
2. **Give it room.** The cheapest capability gain we found was raising a turn
   limit, not changing models. Under-provision and you manufacture false failures.
3. **Run it more than once for anything ambiguous.** One roll is a sample, not a
   measurement; variance tracks how under-determined the question is.
4. **Match the data window to the question.** A fouling verdict wants days; six
   hours can only honestly say "no clear signal yet."
5. **Keep the GPU to itself when timing matters**, and **sanity-check numbers from
   runs that ended on an action.**

### I. Open gaps (what would make this stronger)

1. **Dense-vs-MoE at n≥3** on pump-cycling (currently the Gemma comparison is a
   single roll — not yet a hit-rate).
2. **A multi-day real window** so a fouling verdict can actually settle.
3. **A real pump-cycling run** — pumps are still stub-only; the real-data evidence
   is on the membrane and pH probes. Building the pump real-truth would let the
   "works on real data" claim cover all three equipment types.
4. **n≥3 on pH-control** — the strong pH result is currently one roll per data set;
   replicating it would confirm the behavior distribution (cf. gap-style noise).

> **Three equipment types covered so far** — pump short-cycling (event
> detection), membrane fouling (trend fitting), and pH/dosing (control-loop
> tracking). Different physics, different math, different ground-truth shapes —
> so "it works" is not a one-trick result.

### J. Reproduction

- Run: `scripts/run_probe.sh --probe <name> --data <stub|real> --method unaided`
- Build truth: `probes/<name>/build_truth.py` (real membrane: `--segment-cleanings`)
- Grade: `probes/<name>/score.py --truth … --answers …`
- Tables in this report: `scripts/report_tables.py 'probes/<name>/runs/<glob>'`
- No-GPU regression guard: `scripts/selftest.sh` (<1 s)
- Per-run artifacts (prompt sent, transcript, answer, chart, meta, score) live
  under `probes/<name>/runs/<date>_<model>_<method>_<data>[_<label>]/`.
- Teaching write-ups: `INSIGHTS.md`. Running log: `devlog.md`. Board:
  `results/matrix.md`.

---

*Every claim above traces to a run directory, a scoreboard row, or an INSIGHTS
entry. The honest summary: a local agent does real, accurate analytical work on
real plant data without leaving the machine — and the places it wobbles are
named, explained, and manageable. That combination — capable **and** legible about
its limits — is what makes it a tool you can actually learn to work with.*
