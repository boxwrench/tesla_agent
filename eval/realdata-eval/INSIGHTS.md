# realdata-eval — Insights (teaching collection)

Durable, transferable lessons this project surfaces. Written to be reused in
explainers, the [Title 22](https://www.title22.org/) blog (*water, systems,
strategy*), and the teaching/potable side — not just logged. Each entry: the
observation, the mechanism (so it's understood, not memorized), the teaching
point, and the evidence. Append as the campaign produces more.

---

## #1 — A benchmark number that physics says is impossible

**Observation.** Our own records listed a dense Gemma 4 31B at "43–48 tok/s"
decode on the Strix Halo box. Measured reality: **~8 tok/s.** A 5–6× error,
sitting in the doc we treat as the trustworthy floor.

**Mechanism.** Decode (generating one token) on this hardware is **memory-
bandwidth-bound**: to produce each token the machine must read the model's
weights out of memory. The box moves ~256 GB/s. A dense 31B at Q6 is ~25 GB, and
a *dense* model reads **all** of it per token:

> 25 GB ÷ 256 GB/s ≈ 0.10 s/token ≈ **~10 tokens/second, hard ceiling.**

So 8 tok/s (≈80% of the ceiling) is healthy and near-optimal; 43–48 tok/s is
*physically impossible* — it would require ~1,100 GB/s the hardware doesn't have.
The bad number had been copied from a different model (gpt-oss-120B) measured in
the same session.

**Why an MoE escapes the ceiling.** A Mixture-of-Experts model only activates a
*fraction* of its weights per token. gpt-oss-120B reads ~5B of its params per
token, Qwen 35B-A3B reads ~3B — so they read far less per token and decode much
faster (46 and 54 tok/s measured) *despite being larger overall*. "Total
parameter count" tells you almost nothing about speed; **active bytes-per-token**
tells you almost everything.

**Teaching point.** You can sanity-check any quoted decode speed with one
division: `bandwidth ÷ bytes-read-per-token`. If a *dense* model is quoted above
that ceiling, the number is wrong — no exceptions, no "well-optimized build."
Numbers that are merely *copied* survive in documents until something forces them
to touch reality; a cheap physical bound is that forcing function.

**Evidence.** `KNOWN-GOOD.md` correction + devlog 2026-05-31 (FINDING #2);
measured live via `curl :PORT/completion | .timings.predicted_per_second`.

---

## #2 — Decode speed didn't pick the winner — the two models traded speed for correctness in opposite directions

**Observation.** Same task (read 11 days of pump data, report concerns), same
box, two models, both unaided and *fairly provisioned*:

| | Gemma 31B (dense) | Qwen 3.6 35B (MoE) |
|---|---|---|
| Decode speed | 8 tok/s | **54 tok/s (6.6× faster)** |
| What it did | ~2 tool calls, then wrote a report | 13 turns, consolidated, then wrote a report |
| Wall clock | **348 s** | 889 s |
| Diagnosis | setpoint/controller — **wrong → FAIL** | **short-cycling — right → PASS** |

The slower model was faster end-to-end but reached the **wrong** diagnosis; the
faster model took longer but reached the **right** one. Speed and correctness
moved in *opposite* directions — neither metric predicted the other.

**Mechanism.** An agent's wall-clock is not `tokens ÷ decode-speed`. It's
dominated by **how many tool round-trips it takes**. The dense model was
*decisive* — it looked, concluded, and wrote in ~2 calls — but its quick
conclusion was wrong. The MoE was *thorough* — it segmented the cycles, compared
days, isolated the Jan-5 window, and only then wrote — which cost more rounds but
landed the correct call. Faster per-token bought the MoE the budget to be
thorough without the wall-clock exploding further; it did **not** make it finish
first.

**Teaching point.** Decode tok/s is a *component* benchmark; it does not predict
*task* outcome for agents — not speed, and not correctness. "Upgrade to the
faster model" is not automatically an upgrade, and "the slower model felt
snappy" is not a quality signal. The only thing that settles it is running the
**real end-to-end task** and grading the answer. A speed leaderboard would have
ranked these two models in the exact wrong order for this job.

**The honest footnote (see #4).** Our *first* MoE run looked like a disaster —
20 flailing tool rounds, no report. That was almost entirely our harness
starving it of turns, not the model. Be very careful drawing "model X is bad at
agentic work" conclusions from a run you under-provisioned. The corrected picture
above is the fair one.

**Evidence.** Run dirs `2026-05-31_gemma31_unaided_stub` (FAIL) and
`2026-05-31_qwen36_unaided_stub` (PASS, fair re-run); matrix.md; devlog
2026-05-31.

---

## #3 — "Detected the problem" is not "named the problem"

**Observation.** On the clean stub (which hides a deliberately seeded
short-cycling fault), Gemma got the headline numbers exactly right and even
**charted the fault** — its plot shows a dense burst exactly at the seeded
window — yet in prose it called the cause "drifting setpoint / sensor fault,"
not short-cycling. Graded **FAIL**: it missed *the* pathology the probe exists
to catch.

**Teaching point.** An agent can surface the right *evidence* and still reach the
wrong *diagnosis*; a chart that contains the answer is not the same as an answer.
For operator-facing work, grade the **diagnosis and the recommended action**, not
just whether the numbers and figures are present. It also exposes a rubric
question worth pinning before you trust a score: *what counts as "short-cycling"
— frequency (starts/hour) or duration (run length)?* The model and our
ground-truth used different definitions; both are defensible. Define the term
before grading, or you'll mis-score honest answers.

**Evidence.** `2026-05-31_gemma31_unaided_stub/RESULT.md`; truth.json.

---

## #4 — The same model went from INVALID to PASS without changing a single weight

**Observation.** We ran the Qwen MoE on the pump-cycling probe twice. The first
run was a write-off: 20 tool calls that re-loaded the dataset over and over, no
final report, graded **INVALID**. The second run was a clean **PASS** — it
diagnosed the seeded fault correctly. Between the two runs we changed **nothing
about the model**: same weights, same quantization, same prompt, same data. The
*only* difference was one line of configuration — a turn limit raised from
`20` to `90`.

**Mechanism.** Hermes caps how many agent loops a run may take (`goals.max_turns`).
Our cap was 20. The MoE's working style is to explore first — segment the data,
compare days, isolate the window — and *then* synthesize. That takes more than 20
rounds, so the cap guillotined it mid-exploration, before it ever reached the
"write the answer" step. Raise the cap and the exact same model walks the same
path to completion. The "incompetence" we thought we were measuring was a fence
we'd built one step too close.

> A subtlety worth keeping: under the fair budget the model *also* started
> **saving intermediate results to disk and reloading them** instead of
> recomputing from scratch — entirely on its own, without being told to. The
> "re-reads the whole dataset every turn" behavior we'd blamed on the model was
> itself partly an artifact of turn-starvation panic. Give an agent room and it
> often self-corrects the very habit you were about to "fix" with a prompt.

**Teaching point.** An agent benchmark never measures the model alone — it
measures **the model running inside your scaffolding**. Turn caps, timeouts,
context size, tool latency, and what you do or don't tell it about its
environment are all *part of the score*. Under-provision any of them and you
manufacture a **false negative**: a capable model that looks hopeless. Three
rules fall out of this:

1. **Report the harness with the score.** "Model X failed" is meaningless
   without "…at turn-cap 20, context 8k, no state-persistence hint." Publish the
   config next to the result, every time.
2. **A failure is a hypothesis, not a verdict.** Before concluding "the model
   can't," check whether *you* prevented it. Re-run with the constraint relaxed.
3. **Provisioning is a tuning axis, not a footnote.** The cheapest capability
   gain in this whole project so far wasn't a bigger or smarter model — it was
   editing one integer. Look there first.

This is also a quiet caution for anyone shopping models off public leaderboards:
the score you see is the model *plus whoever's harness ran it*. A model that
ranks low may simply have been run on a short leash.

**Evidence.** `2026-05-31_qwen36_unaided_stub_CUTOFF20/` (INVALID, `max_turns:20`)
vs `2026-05-31_qwen36_unaided_stub/` (PASS, `max_turns:90`); matrix.md
(superseded row preserved); devlog 2026-05-31.

---

## #5 — The same model, run twice, gave opposite diagnoses — so one run is not a measurement

**Observation.** We ran the Qwen MoE on the *identical* pump-cycling task twice,
fairly provisioned both times. The only difference between the two runs was a
single appended sentence telling the agent that shell commands don't share state
(so it should save intermediate results to disk). That note says **nothing** about
what the data means. Yet:

- **Run A** called the Jan-5 anomaly *"classic short-cycling"* → **PASS**.
- **Run B** found the *same* anomaly in *more* detail — then called it *"a
  scheduled forced/flush/top-up run… the data shows nothing broken"* → **FAIL**.

Same model, same weights, same data, a diagnosis-neutral difference — and the
verdict flipped from right to wrong.

**Mechanism.** Two effects are tangled together, and that tangle *is* the lesson:

1. The note plausibly did its job — Run B ran at **20.5 s/turn vs Run A's 68**,
   because it stopped re-loading the 190k-row dataset on every command. That's a
   real, sensible efficiency gain.
2. But the *diagnosis* changed, and the note couldn't have caused that — it never
   mentioned diagnosis. So the flip is almost certainly **sampling variance**:
   a model at non-zero temperature explores different paths on different rolls.
   The seeded fault is genuinely ambiguous *as raw shape* — short bursts at a
   high, flat tank level could be a failure *or* a programmed top-up — and the
   two rolls committed to different readings of the same picture.

With **one run per condition**, "the note made it faster" and "the note made it
wrong" are indistinguishable from "the dice landed differently." You cannot
attribute *either* outcome to the thing you changed.

**Teaching point.** A single agent run is a **sample, not a score**. LLM agents
are stochastic; the interesting, judgment-heavy tasks are exactly the ones where
that randomness bites hardest. If you change one variable, run once, and read the
result, you are measuring **your variable plus the noise**, with no way to tell
them apart. The disciplines that follow:

- **Replicate before you conclude.** Several rolls per condition; report the
  *distribution* (how often it gets the diagnosis right), not a single draw.
- **A flip between two runs is a noise estimate, not a finding** — it's telling
  you the variance is large enough to swamp small effects. Size your experiment
  to it.
- **Beware the demo that worked once.** "I tried it and it nailed it" is one
  sample from a distribution you haven't measured. So is "I tried it and it
  failed." For anything you'll rely on, the question is *how often*, not *did it*.

This is humbling in the right way: our cleanest-looking A/B comparison produced a
result we **can't** cleanly interpret — and noticing that is worth more than a
tidy number would have been. The fix isn't a better prompt; it's more rolls.

**We then did the rolls — and the hypothesis held.** Replicating each condition
to n=3:

| Condition | Diagnoses correct | Notes |
|---|---|---|
| unaided | **3 / 3** | every roll named short-cycling as a fault |
| agentmd (+note) | **1 / 2 completed** | one PASS, one "scheduled run" dismissal, one aborted by a tool-syntax loop |

The decisive line: the **agentmd condition produced *both* a PASS and a FAIL by
itself.** One condition, two opposite verdicts — so the original A→B flip
provably was **not** the note; it was the dice. (And the unaided 3/3 shows the
model genuinely knows short-cycling — the lone Run B dismissal was a minority
draw, exactly the kind of single-sample mirage this insight warns about.) A
bonus: a *third* failure mode showed up only on replication — one agentmd roll
died to a malformed-shell-command guardrail before diagnosing anything — so the
noise lives in *completion* as well as in *diagnosis*. n=1 would have shown you
none of this.

**Evidence.** Six rolls: `2026-05-31_qwen36_unaided_stub{,_r2,_r3}` and
`2026-05-31_qwen36_agentmd_stub{,_r2,_r3}`; rollup in
`results/REPLICATION_pump-cycling_2026-05-31.md`; matrix.md; devlog 2026-05-31.

---

## #6 — A hidden formula in the scorer is method leakage

**Observation.** The first membrane-fouling run correctly diagnosed a strong
fouling trend: raw DPIT slope was exact, mean flow was exact, and the fouling
boolean was correct. It still scored **FAIL/2** because the field named
`normalized_dpit_slope_per_day` did not match truth. The model reported a
reasonable normalization — percent-of-mean-DPIT per day. The scorer expected a
different one — slope of `DPIT / FIT^2` — but the prompt never defined that
formula.

**Mechanism.** "Normalized slope" is not a single universally implied quantity.
For pressure drop under varying flow, `DP / Q^2` is a defensible hydraulic
normalization. For operator trend reporting, "% of baseline per day" is also
defensible. If the rubric silently chooses one, the test is no longer only
grading operational reasoning; it is grading whether the model guessed the
hidden method.

**Teaching point.** A benchmark can leak method in two opposite ways:

- too much method in the prompt, which turns the task into following a recipe;
- too little method in the scoring contract, which turns the score into a hidden
  formula guessing game.

The fix is not "always reveal the recipe." The fix is to decide what axis is
being measured and label it. If the probe is meant to evaluate method discovery,
then the scorer should accept multiple defensible normalizations or grade the
diagnosis separately. If the probe is meant to compare stacks on a fixed
engineering method, put that formula in the allowed method layer and record
`method source = prompt` or `agentmd`.

**Evidence.** `probes/membrane-fouling/runs/2026-05-31_qwen36_unaided_stub/`;
matrix.md; devlog 2026-05-31.

---

## #7 — On real data, the agent out-reasoned our ground truth

**Observation.** Our membrane stub is a clean monotonic fouling ramp; the MoE
scored it 3/3. We then pointed the *same* probe at a real 6-hour SWaT slice — and
the real data isn't a ramp at all. It's a **sawtooth**: differential pressure
sits ~19.9 bar, then crashes to ~2 bar, **13 times** in 6 hours — periodic
clean-in-place (CIP) cycles. (Independently verified: 18.5% of points sit
mid-clean.) Our `build_truth.py` fit **one straight line** across the whole
window, which on sawtooth data is meaningless — it averaged the cleaning crashes
into the slope and declared "no fouling." The agent, unprompted, **segmented the
cleaning cycles out and fit the inter-clean steady-state trend** (~0.80 bar/day,
p<0.001), and flagged a fouling concern. On a real cyclically-cleaned membrane,
the steady inter-backwash rise is *exactly* what an engineer evaluates. **The
agent's method was more correct than our ground truth.**

**Teaching point.** When an agent disagrees with your ground truth, the truth is
not automatically right — especially on real data, where the phenomena are
richer than the toy model you built your truth-builder around. A clean synthetic
stub can hide this forever: the truth model and the seeded data share the same
simple shape, so they always agree, and you mistake that for a validated rubric.
Real data is the audit. Here the eval flipped on its head — the *agent* found the
flaw in the *rubric*. Two rules: (1) never gate real-data scoring on a truth
model you only validated against a stub of matching shape; (2) treat agent-vs-
truth disagreements as a question — *which one is wrong?* — not an automatic
agent FAIL.

**Honesty.** This particular run also *crashed* (Hermes ended on a tool call →
`KeyError: final_response`) under GPU contention, so its emitted `answers.json`
is garbled and the run is INVALID for scoring. The *finding* doesn't depend on
the verdict, though: the sawtooth structure is a fact about the data, and the
agent's segmentation method is in its session log. Real-data membrane grading is
now blocked on a cleaning-cycle-aware truth model — a good problem to have found
before trusting a single real-data score.

**Layer 2 — it recurs.** We *fixed* the truth (linear → cleaning-aware) and a
clean re-run immediately exposed the next naivety. Now agent and truth **agree on
the data** (steady slope ~0.7/day) but the truth calls fouling on `slope > 0.25`
*alone*, while the agent declined — R²=0.05, +1% over 6h, noise-level. The bare
threshold ignores **significance and materiality**; the agent didn't. The lesson
isn't "fix the truth model once" — it's that a sufficiently good agent keeps
auditing your rubric one layer at a time. A real fouling gate needs slope **and**
(R² or p) **and** a minimum absolute rise over a stated horizon.

**Evidence.** `runs/2026-05-31_qwen36_unaided_real/RESULT.md` (crash) and
`..._real_cleanrun/RESULT.md` (valid, layer 2); cleaning-aware `truth.real.json`;
slice via `scripts/make_real_slice.py`; devlog 2026-05-31.

---

## #8 — A benchmark needs the GPU to itself

**Observation.** The real-data run above decoded at **20 tok/s** instead of the
usual **54** — a 2.7× slowdown — purely because a second workload was sharing the
single Strix Halo APU. That throttling pushed an 8-turn run to **820 s against a
900 s cap**, right to the edge of timing out, and contributed to the crash.

**Mechanism.** This box is a **single LLM consumer**: one unified memory pool, one
memory-bandwidth budget (~256 GB/s) that decode is bound by (#1). A second
GPU/LLM job doesn't run "alongside for free" — it *splits the bandwidth*, so the
benched model's tok/s drops in proportion. Any number you record under contention
— throughput, wall-clock, did-it-finish-before-timeout — is measuring *two*
workloads, not the one you meant to bench.

**Teaching point.** While benchmarking, the GPU must be a **sole consumer**.
Contention silently corrupts exactly the timing-sensitive measurements a bench
exists to produce, and can flip a run from "finished" to "timed out / crashed"
without touching the model or the task. Coordinate the single GPU: one bench
roll *or* one other job at a time, never both. (Correctness-only findings — like
#7's sawtooth structure — survive contention; *timing* findings do not.)

**Evidence.** Real-roll decode stamp 20 tok/s vs the day's 54 tok/s baseline;
`runs/2026-05-31_qwen36_unaided_real/meta.txt`; ties to memory
`apu_decode_bandwidth_ceiling`.

---

## #9 — The analysis was reproducible; the one-bit verdict was not

**Observation.** We ran the MoE on the *real* 6-hour membrane slice four times
(one 2026-05-31 clean re-run + an n=3 batch on 2026-06-01, all at sole-consumer
GPU). Reliability was perfect — **all completed at exit 0 and produced a gradeable
answer; zero crashes.** And the *analysis* was strikingly consistent: every roll
independently found the 10 cleaning events, isolated the ~81% operating data, and
computed a steady-state DPIT slope in a tight band (0.63–0.78 bar/day) at a weak
R²≈0.05. Three of four even nailed mean flow within ~3% of truth. **But the
single boolean `fouling_detected` came out `false, false, true, true` — a coin
flip** — on the *same data the same model analyzed the same way.*

**Mechanism.** The window is genuinely borderline: a small positive slope
(~0.7/day) that is *real in direction* but *noise-level in fit* (R²=0.05) over a
horizon (6h) far too short to confirm a multi-day process. When you force that
hedged reality through a one-bit gate, sampling variance decides which side it
lands. The tell is in roll **rel3**: its prose verdict was *"modest early fouling…
but data quality limits confidence… **Do not trigger maintenance based on this
6-hour slice alone; confirm over at least 48 h**"* — a conservative, correct
operator stance — yet it set `fouling_detected = true`. **The boolean and the
narrative disagreed inside the same answer.** The reasoning was sound; the bit was
noise. (A second roll, **rel2**, ended on a tool call mid-synthesis — the harness
recovered an answer, but a truncated one whose `fit_mean` used the *unfiltered*
mean, 1.84 vs 2.21, because it never finished excluding the cleaning zeros. A
distinct, real "stumble" worth naming.)

**Teaching point.** Three rules for working with an agent on real, ambiguous data:

1. **Don't trust a lone boolean on a borderline case.** The model's *analysis* is
   far more reproducible than its *forced verdict*. Read the narrative — it is
   consistent and correctly hedged — rather than reducing the answer to one bit
   and trusting it blind. A yes/no field on an R²=0.05 trend is the *least*
   reliable thing on the page.
2. **The fix for an unstable verdict is usually a better question, not a better
   prompt.** Here the instability is the data telling you 6 hours can't settle a
   fouling call. Extend the window and the verdict stops flipping. Variance is a
   *measurement* of how under-determined your question is (cf. #5).
3. **Watch for tool-call-terminated runs.** When an agent ends on an action
   instead of a synthesis, the "final answer" you recover can be truncated and
   carry half-finished numbers. Completion (exit 0) is necessary, not sufficient —
   check that the emitted numbers came from the *finished* analysis.

This is the campaign's most important honesty: "it works" does **not** mean "every
field of every run is right." It means the agent reliably does sound analysis, and
that the places it wobbles (a forced binary on a borderline case; a truncated
synthesis) are understandable, predictable, and manageable once you know to look.

**Evidence.** Four valid real rolls: `runs/2026-05-31_qwen36_unaided_real_cleanrun`
(false/PASS) and `runs/2026-06-01_qwen36_unaided_real_rel{1,2,3}` (false/true/true);
`scripts/report_tables.py` over that glob; matrix.md; devlog 2026-06-01.

---

## #10 — A domain expert adjudicated an agent-vs-truth disagreement — and the agent won

**Observation.** We added a third probe in the user's own expertise (pH /
disinfection control) precisely so a domain expert could audit the agent's
reasoning instead of taking the math on faith. On the *real* slice the agent and
our ground truth disagreed on the verdict: the agent flagged a **control fault**
(`true`); our truth said `false`. The agent had found a 3-minute dip to pH 6.0
(the acid pump dropped out at 12:00:33, pH crashed, recovered when it came back at
12:03:51), tied it to the actuator, and reasoned the root cause was a
control-signal fault, not a reagent problem. Our truth gate required an excursion
to be **sustained** (≥30 min) to count, so it dismissed the 3-minute event.

**The expert ruled for the agent.** A 3-minute slug of pH-6.0 water reaching
distribution *is* a water-quality event regardless of duration. Our gate was
wrong: it conflated "the control loop drifted off setpoint" (which legitimately
needs to be sustained) with "out-of-spec water happened" (which does not). We
fixed the truth to fire on **either** trigger: a sustained drift beyond the
data-driven operating band, **or** an acute breach of a fixed water-quality limit
(pH outside [6.5, 9.0]), however brief. With that fix the agent and truth agree
(`true`), and the agent scores PASS — for reasoning that was sound all along.

**Mechanism / the subtlety.** This is the mirror image of the probe's *other*
lesson. Probe #3 was built to test the textbook-band trap: real pH runs alkaline
(~8.4), so judging "normal operation" against a fixed [6.5, 8.5] band would
over-flag — the band must be **data-driven**. The agent passed that test (it never
flagged the 8.4 baseline). But "don't use a fixed band for normal-operation
judgment" does **not** mean "never use a fixed limit at all." Acute safety limits
are fixed *by regulation*, and apply no matter where your operating point sits.
Operators carry both bounds at once: a moving control band around setpoint, and
hard regulatory limits. Our first fix removed the fixed band entirely; the
expert's ruling put it back in its correct, narrower role.

**Teaching point.** Three things, in order of importance:

1. **The most valuable audit of an agent is a domain expert checking a case they
   can judge by eye.** We could grade membrane math the user can't personally
   verify and call it "validated"; far stronger is a probe in the user's own field
   where *they* catch the disagreement and rule on it. Pick at least one probe your
   reviewer can adjudicate — it converts trust-by-construction into trust-by-audit.
2. **When the agent and your rubric disagree, the rubric is a suspect too** — for
   the **fourth** time in this campaign (membrane sawtooth → membrane significance
   → pH transient-vs-sustained), the agent exposed a flaw in *our* ground truth,
   not the other way around. A good agent is an auditor of your assumptions. Budget
   for the truth model to keep improving.
3. **"Fix the rubric" can over-correct.** Removing the textbook band fixed the
   over-flagging but left no acute-safety check; the expert restored it in a
   narrower role. A rubric fix is itself a hypothesis — re-examine what it might
   have thrown out.

**Evidence.** `runs/2026-06-01_qwen36_unaided_ph-control_real` — wait, dir is
`runs/2026-06-01_qwen36_unaided_real/` under `probes/ph-control/`; agent brief +
`answers.json` (`control_fault_detected=true`); truth fix in `build_truth.py`
(`acute_abs_low/high` triggers + `fault_trigger` field); stub still PASS; matrix.md;
devlog 2026-06-01.
