# Result — pump-cycling / stub / Qwen 3.6 35B MoE / unaided

**Score: INVALID (incomplete)** — do not compare to Gemma until re-run.

**Date:** 2026-05-31 · **Profile:** realdata-eval-moe (Qwen 3.6 35B-A3B MXFP4,
:8095) · **Decode (stamped): 53.6 tok/s** (verified — 6.6× Gemma's 8.1) ·
**Wall clock: 574 s** · **exit 0**

## What happened

The agent ran **20 tool-call turns and was cut off** by `goals.max_turns: 20`
in the profile config — it never reached the "write the operator report" step.
Every assistant turn was a tool call with empty prose; the run ended on a tool
call, so Hermes had no final content to print (stdout transcript = empty). The
work it did accumulate lives only in the Hermes **session JSON**
(`~/.hermes/profiles/realdata-eval-moe/sessions/session_20260531_074936_707dff.json`).

It did produce 2 charts (`pump_analysis_1.png`, `pump_analysis_2.png`).

## Why it ran out of turns (a real behavior signal)

It was **inefficient with state**: turns 4, 6, 8, 10, 12, 14 each re-ran
`pd.read_parquet('/data/stubs/...')` from a *fresh* `python3` process — so it
reloaded all 190k rows ~10 times instead of building up a result. Each `python3`
invocation is a new process; nothing persists between tool calls unless the
agent writes intermediate state to disk. It burned its 20-turn budget on
re-exploration and never synthesized. (Reasoning volume was modest — ~8.9k
chars total — so thinking was *not* the time sink; the sequential tool rounds
were.)

## Two harness faults this exposed (fix before re-run)

1. **Capture from the session JSON, not stdout.** When a run ends on a tool call
   (no final assistant prose), stdout is empty. `run_probe.sh` must locate the
   profile's newest `sessions/*.json` and extract the final answer + a readable
   tool log into the run dir.
2. **`goals.max_turns: 20` is too low** for the MoE's exploratory style. Raise it
   (e.g. to match `agent.max_turns: 90`) so the agent can reach its conclusion —
   fair provisioning, not coddling. The *inefficiency* remains a gradeable
   observation even with more turns.

## Note for the comparison

Gemma (dense, 8 tok/s) was **decisive**: ~2 tool calls, then wrote a full report
(albeit one that missed the pathology → FAIL/1). The MoE (53 tok/s) was **fast
but undisciplined**: 20 shallow tool rounds, no report. "Faster decode" did not
mean "faster to a useful answer" here — the opposite. That contrast is the real
result of the speed+quality pair, pending a fair MoE re-run.
