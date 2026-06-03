# realdata-eval — devlog

## 2026-06-02 — Gemma 4 26B-A4B plain Vulkan control baseline

Verified the plain Vulkan control lane for Gemma 4 26B-A4B on the reference box. Setup was the no-spec path with F16 KV and reasoning off; Hermes nonce gate cleared 3/3. Measured `pp512 1002.76 ± 10.29 tok/s` and `tg128 44.76 ± 0.90 tok/s` on the control lane.

Then compared against the block-size-3 MTP lane. The useful gain showed up on heavy code generation (`63.23 tok/s`, +41%), but JSON/prose stayed effectively flat (`45.2-46.5 tok/s`) while setup complexity went up. Takeaway: keep the plain Vulkan control lane as the simpler default for general reasoning, JSON extraction, and prose; reserve MTP for code-heavy workloads that justify the extra moving parts.

## 2026-06-01 — ph-control first rolls: expert adjudicated agent vs truth (agent won)

Fired stub + real smoke (sole-GPU, MoE). **Stub PASS** (199s) — found the seeded
acid-overdose, exact numbers. **Real** (268s): agent did NOT take the textbook-band
bait (treated pH ~8.37 as normal), found the real event (acid pump OFF 12:00:33 →
pH 6.0 for 3m19s → recovered), root-caused it as a control-signal fault. Initially
graded FAIL — agent `control_fault_detected=true` vs our `false` (gate required
*sustained* ≥30 min).

**Keith (domain expert) ruled the agent right:** a 3-min slug of pH-6.0 water is a
water-quality event regardless of duration. Fixed `build_truth.py` — fault now
fires on EITHER sustained drift beyond the data-driven band OR an **acute breach**
of fixed limits [6.5, 9.0]; added `fault_trigger` + `acute_breach_samples`. Real
truth → true (trigger acute_breach), agent and truth agree → **PASS**. Stub still
PASS; selftest 3/3 green. INSIGHTS #10 (the mirror of #6: don't use a textbook band
for normal-op judgment, but DO keep fixed limits for acute safety — operators carry
both bounds). 4th time the agent exposed a truth-model flaw; 1st expert-adjudicated.

## 2026-06-01 — probe #3: ph-control (operator-auditable, disinfection/dosing)

Keith picked a third scenario in his own domain (he can't personally audit
membrane math, so a probe he *can* check makes him the ground-truth). Chose **pH
control** (AIT-202 + HCl pump P-203) over ORP/conductivity. Data reality that
shaped the design: real SWaT pH is tightly held at **8.55** (std 0.115) — a
textbook [6.5,8.5] band would flag 58% of *normal* operation. So the truth model
derives the **operating band from the data** (median ± max(3·MAD-σ, 0.3)) and
calls a control fault only on a **sustained (≥30 min) + material (≥0.5 pH)**
excursion — the membrane significance-gate pattern, and a built-in test of the
INSIGHTS #6 hidden-band trap.

Third physics type by design: pump=event-detection, membrane=trend-fitting,
**ph=control-loop tracking.**

Built + verified (no GPU): `synth_ph_stub.py` (seed 44; pH held 7.55, acid pump
sticks ON → 4 h overdose crash to 5.6 = sustained fault, truth `fault=true`);
`build_truth.py` (stub + real); real 12 h slice (pH ~8.4, one 3-min dip to 6.0 =
transient → `fault=false`); `score.py` (gating `ph_mean`+`control_fault_detected`,
informational `ph_min`/`ph_max`/`dosing_duty_pct`). Scorer verified on 4 hand cases
incl. the **textbook-band trap failing as intended**. selftest extended (3/3 probes
green). No agent runs yet — next.

## 2026-06-01 — real-data reliability batch (n=3) + REPORT.md → field guide

Fired membrane-real n=3 at **sole-consumer GPU** (MoE only model loaded). Goal:
evidence for "it doesn't break" + "meaningful accurate inference," and material to
paint the scenario / show prompt+output / show failure→fix.

**Reliability: 4/4 valid real rolls completed at exit 0, zero crashes** (cleanrun
+ rel1/2/3). Built `scripts/report_tables.py` (no-GPU aggregator → reliability +
accuracy tables from run artifacts; smoke-tested on the 05-31 runs).

**The finding (INSIGHTS #9):** the *analysis* is reproducible (every roll: 10
cleanings, slope 0.63–0.78/day, R²≈0.05, "6 h too short"), but the one-bit
`fouling_detected` came out **false/false/true/true** — a coin flip on the same
data. rel3 wrote "Do not trigger maintenance on this 6-h slice alone" yet set the
flag `true` (narrative ≠ boolean). rel2 ended on a tool call → truncated synthesis
→ unfiltered fit_mean (1.84 vs 2.21). Lesson: trust the analysis, supervise the
forced verdict; fix a flapping verdict with a longer window, not a better prompt.

**REPORT.md rewritten as a field guide** (not a product sheet, per Keith): paints
the scenario, shows the verbatim prompt + the agent's own cleaning-discovery
tool output + the operator brief, then a §F "where it didn't work and what we
changed" walking all 5 failure→fix journeys (turn-cap, contention crash, truth-
too-naive ×2, boolean instability, truncated-synthesis). Matrix +3 rows;
replication rollup at `results/REPLICATION_membrane-real_2026-06-01.md`.

## 2026-06-01 — bench hardened to no-cloud + campaign REPORT.md

Goal crystallized: be able to say *"my local agent basically works, with
caveats,"* and ship a report. Two moves:

- **No-cloud hardening (structural).** The `realdata-eval-moe` Hermes profile
  carried a cloud *fallback* (`openrouter / deepseek-v4-pro`) with a live API
  key — a latent off-box path if the local endpoint stalled. For benches:
  fallback now pinned to the **same local `127.0.0.1:8095` endpoint**, and the
  `OPENROUTER_API_KEY` removed from the profile `.env`. A bench run now has **no
  structural path off the machine**. Backups: `config.yaml.bak.*`, `.env.bak.*`
  (personal cloud-fallback preserved there; hardening scoped to this profile
  only). Verified: `yaml.safe_load` → primary+fallback both local; 0 active API
  keys. Per-run no-cloud evidence remains the local llama.cpp decode stamp in
  each `meta.txt`.
- **REPORT.md** written — two-layer like the public repo: Layer 1 is an
  operator-legible verdict (*works, basically, with 4 stated caveats*); Layer 2
  is the expert evidence (the agentic-loop trace, the no-cloud verification, the
  graded results, the two agent-vs-truth findings, the methodology, the open
  gaps, reproduction pointers). Every claim traces to a run dir / matrix row /
  INSIGHTS entry.

**Next (open gaps named in the report):** Gemma dense → n≥3 on pump-cycling
(dense-vs-MoE hit-rate, needs exclusive GPU); a multi-day real window for a true
fouling verdict; real-data replicates for a behavior distribution.

## 2026-05-30 — scaffold

Project established at `docs/projects/realdata-eval/`. Peer of
`qwen-tool-calling` and `american-stack`. Frames real-plant-data
agent evaluation as a discipline, not a one-off run.

- Defined "probe" plainly (jar-test analog) in README + PROBE.md.
- Locked first probe as **pump-cycling** (`LIT-101` × `P-101`):
  universal across facilities, ground-truth is computable, tunable
  difficulty.
- Tied to sister project **potable** via `potable_category` tag on
  every PROBE.md. Pump-cycling maps to
  `systems_integration_and_equipment_behavior`.
- Synthetic stub committed at `data/stubs/pump_cycling_v1.parquet`
  (11 days, 5 s cadence, deterministic seed 42, with a seeded 4-hour
  short-cycle window for the rubric to catch).
- Ground-truth + scorer wired (`build_truth.py`, `score.py`,
  `truth.json`). No agent runs yet.
- Future direction noted in plan.md: KG / vector representation over
  the raw datasets, after probes #1–3 are running.

**Next:** write `run_probe.sh`, first agent run on 35B MoE oneshot,
log into `probes/pump-cycling/runs/2026-MM-DD_qwen35_oneshot/`.

## 2026-05-30 — data acquired, normalizer + scoring rig proven

Pulled both data substrates:
- **Stub** generated (`data/stubs/pump_cycling_v1.parquet`, seed 42).
- **Real SWaT** `SWaT_Dataset_Attack_v0.csv`, 128 MB, 449,917 rows,
  Dec 2015 attack set, via the firmai mirror. **git-LFS gotcha:** the
  `raw.githubusercontent.com` URL serves a 134-byte LFS *pointer*, not
  the data; the `github.com/.../raw/` redirect path resolves LFS.
  (Caught by a file-size sanity check — first integrity heuristic to
  earn its keep.)

Toolchain: system python lacks pandas; `~/.venvs/vllm-rocm/bin/python`
has pandas 3.0.3 + pyarrow 24. Use that interpreter for this project.

Built the **normalizer** (`probes/pump-cycling/load.py`) — the
messy→canonical bridge both stub and real data flow through. Design:
structural column-name rule (no fuzzy matching) + explicit-format
timestamp parsing + quarantine-and-report for a sub-threshold residue;
fail-loud above `max_bad_frac`. Wired `build_truth.py` through it.

Three real-data lessons, each now a teaching example:

1. **Timestamps — precision beats cleverness.** 2 of 449,917 rows
   (`29/12/2015 7:11:22 AM`, `2/1/2016 10:16:31 AM`) failed pandas
   *format inference* despite pristine bytes and valid format. An
   explicit format string parses all 449,917 with zero failures. Root
   cause was the parser guessing, not the data.

2. **Semantic normalization is a SECOND layer.** Column-name mapping
   is not enough. Real SWaT `LIT-101` is **190–925 mm** (not 0–100 %)
   and `P-101` ∈ **{1=off, 2=on}** (not {0,1}). A cycle counter
   assuming {0,1} would count ZERO transitions on real data —
   wrong-but-green. A value-domain check catches it; a name check does
   not. **This layer is NOT yet built** — real-data truth is blocked
   on it. Stub truth is valid (stub uses canonical encoding).

3. **Our own fixture was too gentle.** First `build_truth` run found
   no short-cycle window — the seeded pathology (band 75–78) produced
   ~10.7 starts/hr, just under the 12/hr threshold. Tightened seeded
   band to 77–78 → genuine short-cycling (peak 25 starts/hr,
   2026-01-05 04:42→08:33). Fixture now exercises all three scored
   quantities.

Scoring rig proven end-to-end on the stub: perfect answer → ok/exit 0,
deliberately-wrong answer → fail/exit 1 with failing checks named.

**Next:**
- Build the **value/semantic normalization** layer (P-101 {1,2}→{0,1},
  LIT band thresholds in the data's native unit) + a domain/range
  integrity check, so real-data truth can be computed.
- Then `run_probe.sh` + first agent run on 35B MoE.

## 2026-05-30 (cont.) — value/semantic normalization + integrity built

Real SWaT now flows end-to-end to a correct ground-truth.

- **`load.py` value layer.** Actuator tags (P*/MV*/UV*) normalized to
  canonical {0=off,1=on}. Explicit + fail-loud, NOT auto-guess:
  {0,1} passthrough, {1,2}→{0,1}, {0,1,2} with 0=transition held to
  prior state; unknown domains raise; a *single-state* actuator raises
  (can't tell off from on without a cycle). Detected encoding is
  surfaced in `df.attrs["encodings"]` and printed — never silent.
- **`integrity.py` (new).** The packing-slip check: rows, span,
  cadence + gap count, monotonic/duplicate timestamps, per-tag domain,
  actuator-state sanity, LIT unit hint (percent vs engineering).
  `report()` never raises; `assert_ok()` raises on blocking flags.
  Wired into `build_truth.py` before any math runs.

Two more real-data findings (both now handled):

4. **P-101 is a DRAIN pump in SWaT** (ON at high level ~812, OFF at low
   ~529 mm) — opposite polarity from the stub's fill pump. The band
   code assumed fill, so it mislabeled the edges. Fixed: band is the
   min/max envelope (direction-agnostic) + a `pump_action` field
   ("fill (on when low)" / "drain (on when high)").
5. **Unit-aware tolerance had a sign bug.** `band_span = high - low`
   went negative under the inverted (drain) edges, collapsing the
   tolerance to its 2.0 floor. Fixed by min/max envelope → span always
   ≥0. Real tol now 14.17 mm (5% of 283 mm band); stub stays 2.0 %.

Verified: stub truth regenerated (band 45–80 %, fill, 1 short-cycle
window); real truth computes (band 529–812 mm, drain, tol 14.17, 0
windows in this attack-set window); scorer still passes on stub truth.

**Next:** `run_probe.sh` driver + first agent run on 35B MoE oneshot.
Contiguous-window sampling (plan.md item 3) still open — useful for
fast iteration but not blocking.

## 2026-05-30 (cont.) — pre-flight recon; FINDING #1: sandbox not data-ready

Prepping the first real agent run surfaced a production-readiness gap
*before* a single token was generated — which is the eval working as
intended.

Runtime state:
- Local inference healthy. Gemma 4 31B Q6_K hot on :8097 (returns
  PONG). Hermes v0.14.0 live, active profile `localplan`. Profiles for
  the whole zoo exist (qwen35plan, qwen122plan, gemma31-eval, ...).
- `prompt.md` de-leaked: now a natural operator request, no method, no
  metrics, no JSON. (Why no JSON: it was grading convenience leaking
  into the task, not a production need. Grade the raw attempt by hand.)

**FINDING #1 — the production agent's sandbox cannot do data analysis
as configured.** Hermes terminal backend = docker, image =
`nikolaik/python-nodejs:python3.11-nodejs20`. That base image has **no
pandas**, and `docker_mount_cwd_to_workspace: false` + `docker_volumes:
[]` means **the 128 MB CSV is not even mounted into the sandbox**. So a
raw attempt would fail on environment, not on model reasoning: the
agent can't reach the file and can't `import pandas`.

This is a real result: "can production do operator data analysis today"
→ **no, the execution environment isn't provisioned for it.** It's a
build item, not a model failure. Options to enable a model-level run:
  (a) mount the data dir read-only into the sandbox (docker_volumes),
  (b) make pandas available (custom image, or agent pip-installs at
      runtime, or stdlib-csv only — slower but no dep),
  (c) decide whether provisioning belongs in the eval or is a Hermes
      stack change (touches the live config.yaml → confirm first).

**Next:** provision the minimal enabling path (mount data RO + pandas),
THEN roll the dice on the model's actual analysis ability. Logging this
as the first row of evidence the future router needs: "data-analysis
tasks require a provisioned sandbox."

## 2026-05-30 (cont.) — sandbox provisioned + agent toolbox defined

Resolved Finding #1 by provisioning the agent's environment (user
chose "provision minimally, then roll", then broadened to a defined
toolbox: "if we know the toolbox we can build the agent to use it").

- **`sandbox/Dockerfile` + `sandbox/README.md`** — the standard agent
  toolbox as code: pandas, numpy, pyarrow, scipy, matplotlib, openpyxl,
  tabulate. Image `hermes-realdata-eval:latest`. Build self-checks
  (fails if any lib won't import). README justifies each lib and lists
  what's deliberately excluded (statsmodels, sklearn→cyber project,
  db drivers).
- **Live Hermes config changed** (`~/.hermes/config.yaml`, backed up to
  `config.yaml.bak.realdata-eval-*`):
    - `terminal.docker_image` → `hermes-realdata-eval:latest`
    - `terminal.docker_volumes` → mounts the project `data/` dir
      read-only at `/data`.
  NOTE: these are global terminal settings — they affect ALL Hermes
  terminal runs, not just eval. Revert from the backup if it disrupts
  other work. (Future: scope per-profile if Hermes supports it.)
- **Verified** in a Hermes-style `docker run`: pandas 2.2.3 present,
  `/data` visible, both datasets reachable, writes blocked (RO).
- **`agent_context.md`** — capability preamble for the agent: declares
  the terminal tool, the toolbox, and the read-only `/data` mount —
  and deliberately nothing about method/metrics/schema. Encodes the
  capability-vs-method line (capabilities fair to give; method is not).
- **`prompt.md` de-leaked** to a natural operator question, no JSON.

**Next:** `run_probe.sh` to inject `agent_context.md` + the probe
prompt into a Hermes run (terminal tool on), capture transcript +
output to a run dir, then grade the raw attempt by hand. First model =
whatever's hot/policy (Gemma 4 31B currently on :8097; 35B is the
data-analysis policy route — load for the faithful run).

## 2026-05-31 — pre-flight: throughput truth + Hermes profile architecture

Two findings before the first roll, both from grounding the plan against
the live box (not assumptions):

- **FINDING #2 — recorded Gemma 31B throughput was 5–6× too high.** KNOWN-GOOD
  listed Gemma 4 31B Q6_K at "43–48 tok/s." Measured on `:8097` (same server,
  same `gemma31_vulkan_serve.sh`, healthy GPU, idle box): **8.1–8.4 tok/s decode**,
  stable across two runs. Root cause: the figure was **carried over from the
  gpt-oss-120B measurement** in the same 2026-05-29 graduation session (identical
  "2.3× faster than 122b's 19 tok/s" sentence); the Gemma gate recorded no
  throughput of its own. Physics confirms which number is wrong: dense decode is
  memory-bandwidth-bound — 25.2 GB ÷ ~256 GB/s LPDDR5X = **~10 tok/s hard
  ceiling**; 8.1 measured = ~80% MBU = near-optimal. gpt-oss-120B's 46 tok/s is
  legit because it's a ~5B-active MoE (reads far less per token). **Corrected
  `docs/KNOWN-GOOD.md:104`** (annotated, dated); the american-stack devlog line
  is correct as-is (it's the gpt-oss section). *Implication:* dense Gemma 31B is a
  slow agent baseline; the MoE 35B-A3B is both faster and the policy-faithful
  route. This is the project doing its job on day one.

- **FINDING #3 — the global Hermes config edits don't reach a model run.** Runs
  select a model via `hermes -p <profile>` (per-invocation flag; the alias
  wrappers are literally `hermes -p <name> "$@"`). **Each profile has its own
  `~/.hermes/profiles/<name>/config.yaml`.** The `terminal.docker_image` +
  `/data` mount edited last session live in `~/.hermes/config.yaml` = the
  **`default` profile** (deepseek cloud) — they are **inert** for a `gemma31-eval`
  / `qwen36plan` run. `gemma31-eval` currently has `docker_image: nikolaik/...`
  (no toolbox) and `docker_volumes: []` (no `/data`). So the sandbox must be
  provisioned in **the profile actually used**. Plan: a dedicated `realdata-eval`
  profile (cloned, sandbox-provisioned) so the american-stack gating profiles
  stay pristine and `default` isn't polluted.

**Decision (this session):** first campaign = **both** MoE Qwen 35B-A3B *and*
dense Gemma 31B on the same probe — a speed+quality pair. MoE is the fast,
policy-faithful baseline; Gemma 31B is the graduated CODE peer and the slow
end. Capture decode tok/s + answer quality for each.

**Next:** build `run_probe.sh` (model-agnostic via `-p`), provision a
`realdata-eval` profile with the toolbox sandbox + `/data:ro` + `/out:rw`, fire
the pump-cycling stub roll to prove the rig, then the real-data rolls on both
models.

## 2026-05-31 — first rolls, grading, probe #2, AssetOpsBench smoke

Track B baseline work landed.

**run_probe + pump-cycling.** `scripts/run_probe.sh` is now the
one-command probe driver. It injects `agent_context.md` + the probe
request, runs Hermes with the selected profile, captures
`transcript.log`, harvests `/out`, and now creates `output.md` plus a
canonical `level_vs_pump.png` when the agent only emits stdout or uses
the older chart name. The Gemma 31B stub roll completed in 348 s and
produced transcript, final answer, charts, `answers.json`, `score.json`,
and `RESULT.md`.

**Grading result.** Gemma 31B scored `FAIL/1` on pump-cycling:
starts/hour and level band passed, but the agent missed the seeded
short-cycle window (`2026-01-05T04:42:00` to `2026-01-05T08:33:00`)
and described the symptom as controller/setpoint instability instead.
That is a useful failure: the run was operationally plausible but
missed the main rubric pathology. Matrix row added. A Qwen MoE stub
roll is also recorded as `INVALID`: it hit the turn cap before a final
report, so that is a harness/session issue rather than a numeric model
score.

**Probe #2 scaffolded.** Added `membrane-fouling` (`DPIT-301`,
`FIT-301`, potable category `filtration`) plus
`scripts/synth_membrane_stub.py`. The truth builder computes raw DPIT
slope, flow-normalized DPIT slope, mean FIT, DPIT start/end percent
change, and a fouling boolean. Verified:

- stub truth builds clean through `integrity.assert_ok`;
- real SWaT slice `2015-12-29T00:00:00` to `2015-12-29T06:00:00`
  builds clean through `integrity.assert_ok`;
- scorer passes a handwritten correct `answers.json` and fails a
  handwritten wrong one.

**AssetOpsBench smoke.** CouchDB is healthy and populated:
`iot=10218 docs`, `workorder=12269 docs`, `vibration=4097 docs`.
Started Gemma 31B on `127.0.0.1:8097`, set
`LITELLM_BASE_URL=http://127.0.0.1:8097/v1`, and ran:

```bash
uv run plan-execute \
  --model-id openai/gemma-4-31B-it-Q6_K.gguf \
  --show-plan --show-trajectory \
  "List all sensors of Chiller 6 in MAIN site"
```

Result: pass. The runner planned `iot.assets` then `iot.sensors`,
called both tools, and returned 11 sensors for Chiller 6. First
water/operational-scope triage is recorded in `related/assetopsbench.md`.

**Config note.** Existing Hermes global-config backup:
`~/.hermes/config.yaml.bak.realdata-eval-20260530_193821`.
Current eval profile is
`~/.hermes/profiles/realdata-eval/config.yaml`; it mounts
project `data/` read-only at `/data` and `.scratch` at `/out`.

**Next:** fix the harness turn/session issue exposed by the Qwen MoE
invalid run, rerun the fast baseline, then run membrane-fouling as the
second real agent probe.

## 2026-05-31 (cont.) — MoE fair re-run PASSES; method-axis B in flight

**Harness fixes applied** (the two faults the cutoff exposed):
`goals.max_turns` raised 20→90 in the `realdata-eval-moe` profile, and
`run_probe.sh` now recovers the answer from the Hermes **session JSON**
via `extract_session.py` (stdout is empty when a run ends on a tool
call). The cut-off run is preserved as
`runs/2026-05-31_qwen36_unaided_stub_CUTOFF20/` for the record.

**MoE fair re-run = PASS/1.** With a fair budget the Qwen 3.6 35B MoE
finished cleanly in **13 turns (10 tool), 889 s @ 54.5 tok/s** and
**named the short-cycling explicitly** — the exact diagnosis Gemma
missed. Baseline (21 cycles/day, Jan 5 = 107) exact, band 45–80 ✓,
window Jan 5 04:17–08:00 (within tol) ✓, two charts. Notably it
**persisted intermediates to `/out` on its own** (`on_segments.csv`,
`off_segments.csv`, `*_durs.npy`) and reused them — the "re-`read_parquet`
every turn" thrash from the cutoff run was a **turn-starvation artifact,
not intrinsic model behavior**. Matrix promoted INVALID→PASS; the
speed+quality pair now reads: dense Gemma faster end-to-end but wrong
diagnosis (FAIL); MoE slower (more tool rounds) but right (PASS).

**Method-axis Run B in flight.** Added a `--note` flag to
`run_probe.sh` that appends a single method-axis treatment to the prompt
(logged verbatim to `meta.txt`), keeping the unaided baseline preamble
clean so the delta is isolated. Run B = same MoE/stub with one
sandbox-fact note ("each shell command is a fresh process; persist
reusable state to `/out`"), `method=agentmd`. Measures how much friction
that one fact removes vs the unaided 13-turn baseline (which already
self-persisted, so the honest expectation is a small delta). Result +
INSIGHTS #2 rewrite to follow once it lands.

**Next:** grade Run B, rewrite INSIGHTS #2 with the corrected (fair-
budget) picture, then generalize `run_probe.sh` data-path resolution
per-probe so Keith's `membrane-fouling` probe can roll through the same
harness.

## 2026-05-31 (cont.) — Run B (method-axis) flips PASS→FAIL: n=1 isn't a measurement

**Run B graded = FAIL/1**, and it's the most instructive run of the day.
Same MoE, same stub, +1 diagnosis-neutral sandbox-fact note
(`method=agentmd`). 17 turns, **349 s @ 55.7 tok/s** — *2.5× faster than
Run A* (20.5 vs 68 s/turn), consistent with the note's intent (it stopped
re-loading the 190k-row dataset every command). It located the Jan-5
window *more* precisely than the PASS run (90 bursts, ~100 s runs, high-
level start) — then **dismissed it** as "a scheduled forced/flush run…
nothing broken," never naming short-cycling. Diagnosis flipped right→wrong
on a change that says nothing about diagnosis.

**Interpretation (the real finding).** The note plausibly bought
efficiency (real method effect) *and* the diagnosis flipped (can't be the
note → sampling variance). With **n=1 per condition** the two are
inseparable. So our cleanest-looking A/B produced a result we can't
cleanly attribute — which is itself the lesson. New **INSIGHTS #5** ("the
same model, run twice, gave opposite diagnoses — one run is not a
measurement"): replicate ≥3× per condition and read the *distribution* of
diagnoses before claiming any method effect.

**Docs updated this batch:** INSIGHTS #2 rewritten (corrected fair-budget
picture; old "MoE produced none" was a provisioning artifact), #4 added
(INVALID→PASS on one config integer), #5 added (variance / n=1); README
status + lessons blurb; matrix rows (MoE PASS + agentmd FAIL +
superseded INVALID); both RESULT.md files. `run_probe.sh` gained a
`--note` flag (conditional, verbatim-logged method treatment) and
**per-probe data-path resolution** (verified pump + membrane resolve;
host files present) so `membrane-fouling` can roll through the same
harness.

**Next:** replicate the pump-cycling cell (≥3 MoE rolls each for unaided
and agentmd) to get a diagnosis hit-rate instead of single draws; then
roll Keith's `membrane-fouling` probe (#2) on both models. Pin the
short-cycling rubric (frequency vs duration) in truth.json/PROBE.md
before trusting borderline scores.

## 2026-05-31 (cont.) — replication: the flip was variance, n=3 hit-rates

Ran 4 more MoE rolls (new `--label rN` flag for unique run dirs) to take
each pump-cycling condition to n=3. Result:

- **unaided 3/3** correctly named short-cycling as a fault (r1 "classic
  short-cycling"; r2 "hunting/chatter" → hysteresis deadband fix; r3
  "rapid-cycling loop… not normal").
- **agentmd 1/2 completed** (r1 dismissed as "scheduled run" = FAIL; r2
  "short cycling is bad practice" = PASS; r3 INVALID — aborted at 5 turns
  by a tool-syntax guardrail after writing `&` backgrounding).

**Settles the A/B question:** the agentmd condition produced *both* a
PASS and a FAIL on its own ⇒ the Run A→B flip was **sampling variance,
not the note**. INSIGHTS #5 updated from hypothesis to confirmed, with
the hit-rate table. Unaided's 3/3 shows the model reliably knows the
pathology; Run B's dismissal was a minority draw. Three distinct failure
modes now seen across the campaign (turn-cap cutoff, detect-but-dismiss,
tool-syntax loop) — noise lives in completion as well as diagnosis. Full
rollup: `results/REPLICATION_pump-cycling_2026-05-31.md`; 4 matrix rows
added.

**Honest verdict on the sandbox note:** bought per-turn efficiency (fewer
dataset re-reads) but no demonstrated diagnosis benefit; agentmd looked
worse (1 PASS / 1 dismissal / 1 abort) but at n=3 with this variance the
difference is not significant. No evidence it helps.

**Next:** roll Keith's `membrane-fouling` probe (#2) through the now
probe-general harness; consider Gemma replication for a dense-vs-MoE
hit-rate comparison; pin the short-cycling rubric before borderline
scoring.

## 2026-05-31 (cont.) — membrane-fouling first agent run

Ran `membrane-fouling` on the stub with Qwen 3.6 35B MoE unaided
(`realdata-eval-moe`). The run completed cleanly in 99 s, with 7
assistant turns / 6 tool turns, and saved two charts plus
`answers.json`.

Official numeric score: **FAIL/2**.

Passed:
- raw `DPIT-301` slope: truth `1.6335`, answer `1.633513`;
- mean `FIT-301`: truth `2.0999`, answer `2.0999`;
- fouling flag: truth `true`, answer `true`.

Failed:
- normalized DPIT slope: truth `0.3782`, answer `0.091852`;
- DPIT change percent: truth `78.16`, answer `87.5025`.

Important interpretation: this is partly a **rubric-contract failure**.
The truth builder grades flow-normalized pressure drop as the slope of
`DPIT / FIT^2`, but `prompt.md` only asked for a "normalized" slope and
did not define the formula. The agent chose a different defensible
normalization: percent-of-mean-DPIT per day. Before using
membrane-fouling for stack comparisons, tighten the output contract or
explicitly place the normalization method in the allowed scaffolding
layer. Otherwise the probe is grading hidden method agreement, not just
operational reasoning.

## 2026-05-31 (cont.) — real-data path built; first real roll audits our truth

Built the dual-truth / real-slice infrastructure (additive, non-breaking):
`scripts/make_real_slice.py` (parallel to synth_stub; carves a canonical
window through the same normalizer the truth uses), `data/real_slices/`
(gitignored like raw/), `truth.real.json` per probe, and the `data_paths.sh`
override so `run_probe.sh --data real` points at the slice. `score.py` already
took `--truth`. Verified resolution + mounts; added `scripts/selftest.sh`
guarding the case-extraction bug and the membrane operational gate (green).

**First real-data roll (membrane, MoE) — INVALID but the project's best finding
yet.** It crashed (`KeyError: final_response`, ended on a tool call — the known
Hermes one-shot gotcha) at 820s/20 tok/s under GPU contention, and its
`answers.json` (slope -7.54 yet fouling=true) is garbled. Don't grade it.
**But:** the real 6h window is a **sawtooth** — DPIT sits ~19.9 bar and crashes
to ~2 at **13 CIP cleanings** (18.5% of points mid-clean, verified
independently). Our `build_truth.py` fits one linear slope across that →
meaningless (0.2748/day, fouling=false). The agent, unprompted, **segmented the
cleanings and fit the inter-clean steady trend (~0.80/day, p<0.001)** →
fouling=true. **The agent out-reasoned our ground truth.** New INSIGHTS #7 (real
data audits the rubric; agent-vs-truth disagreement is a question, not an
auto-FAIL) and #8 (a bench needs the GPU to itself — contention dropped decode
54→20 tok/s and pushed the run to the timeout edge).

**Blocks/decisions:**
- Real-data membrane grading is **blocked on a cleaning-cycle-aware truth model**
  (segment on cleanings → inter-clean fouling rate). `truth.real.json` marked
  PROVISIONAL in PROBE.md — do not gate on it. Domain call.
- Hermes `KeyError: final_response` recurred; consider a post-loop final-answer
  fetch in run_probe.sh so tool-call-terminated runs don't crash.
- **Bench hygiene:** no GPU rolls while another GPU job runs (and vice-versa).

**Next:** clean re-run on an exclusive GPU once free; design the cleaning-aware
real truth; then the real-data membrane comparison is meaningful.
