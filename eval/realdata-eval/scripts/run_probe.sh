#!/usr/bin/env bash
set -euo pipefail
# run_probe.sh — fire one realdata-eval probe at a local model via Hermes and
# capture the raw attempt for by-hand grading.
#
# It assembles the prompt from two de-leaked sources (capability preamble +
# the probe's natural operator question), runs a one-shot Hermes agent with the
# terminal tool enabled, and saves transcript + prompt + any /out artifacts
# (e.g. charts) into a dated run dir. It does NOT grade — grading is by hand
# vs truth.json (see the probe's prompt.md "Grading" section).
#
# Model selection is by Hermes PROFILE (`hermes -p`), so this script is
# model-agnostic: point --profile at realdata-eval (Gemma 31B :8097) or any
# other sandbox-provisioned profile. The profile MUST carry the toolbox image
# + /data:ro + /out mounts (see devlog 2026-05-31 FINDING #3).
#
# Usage:
#   scripts/run_probe.sh --data stub            # default profile realdata-eval (Gemma 31B)
#   scripts/run_probe.sh --data real --profile realdata-eval-moe --model-tag qwen35
#
# Flags:
#   --probe NAME      probe dir under probes/ (default: pump-cycling)
#   --data stub|real  which dataset to point the agent at (default: stub)
#   --profile NAME    Hermes profile = model selector (default: realdata-eval)
#   --model-tag TAG   short label for the run dir (default: gemma31)
#   --method SRC      method-source bookkeeping label (default: unaided)
#   --timeout SECS    hard cap on the run (default: 1800 — decode is slow)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # realdata-eval/
cd "$ROOT"

PROBE=pump-cycling
DATA=stub
PROFILE=realdata-eval
MODEL_TAG=gemma31
METHOD=unaided
TIMEOUT=1800
NOTE=""    # optional method-axis treatment appended to the prompt (logged verbatim)
LABEL=""   # optional run-dir suffix — distinguishes replicate rolls of one cell

while [[ $# -gt 0 ]]; do
  case "$1" in
    --probe)      PROBE="$2"; shift 2;;
    --data)       DATA="$2"; shift 2;;
    --profile)    PROFILE="$2"; shift 2;;
    --model-tag)  MODEL_TAG="$2"; shift 2;;
    --method)     METHOD="$2"; shift 2;;
    --timeout)    TIMEOUT="$2"; shift 2;;
    --note)       NOTE="$2"; shift 2;;
    --label)      LABEL="$2"; shift 2;;
    *) echo "unknown flag: $1" >&2; exit 2;;
  esac
done

PROBE_DIR="probes/$PROBE"
[[ -d "$PROBE_DIR" ]] || { echo "no such probe: $PROBE_DIR" >&2; exit 1; }

# in-sandbox data path (mounted RO at /data). Resolved per-probe so any probe
# can roll through this harness, not just pump-cycling:
#   stub = /data/stubs/<probe-with-underscores>_v1.parquet  (convention)
#   real = the shared SWaT CSV
# A probe may override by dropping a data_paths.sh that sets STUB_PATH/REAL_PATH.
STUB_PATH="/data/stubs/${PROBE//-/_}_v1.parquet"
REAL_PATH="/data/raw/SWaT_Dataset_Attack_v0.csv"
[[ -f "$PROBE_DIR/data_paths.sh" ]] && source "$PROBE_DIR/data_paths.sh"
case "$DATA" in
  stub) SANDBOX_DATA="$STUB_PATH";;
  real) SANDBOX_DATA="$REAL_PATH";;
  *) echo "--data must be stub|real, got: $DATA" >&2; exit 2;;
esac
# pre-flight: /data maps to the project data/ dir; warn if the host file is absent
HOST_DATA="${SANDBOX_DATA/#\/data//$ROOT/data}"
[[ -f "$HOST_DATA" ]] || echo "   !! warning: host data file not found: $HOST_DATA (run will likely fail in-sandbox)" >&2

# --- assemble the prompt from the two de-leaked sources -----------------------
# capability preamble: the injected block in agent_context.md
PREAMBLE="$(awk '/^## Preamble text/{f=1;next} /^## What this preamble does NOT say/{f=0} f' agent_context.md | sed '/^---$/d')"
# the request: the blockquote under "## The request" in the probe prompt.md
# (header match is case-insensitive — probes vary "request" vs "Request")
REQUEST="$(awk 'tolower($0) ~ /^## the request/{f=1;next} /^## /{if(f)f=0} f&&/^>/{sub(/^> ?/,"");print}' "$PROBE_DIR/prompt.md")"
REQUEST="${REQUEST//<DATA_PATH>/$SANDBOX_DATA}"

[[ -n "$PREAMBLE" ]] || { echo "could not extract preamble from agent_context.md" >&2; exit 1; }
[[ -n "$REQUEST"  ]] || { echo "could not extract request from $PROBE_DIR/prompt.md" >&2; exit 1; }

PROMPT="$PREAMBLE

$REQUEST"

# optional method-axis note (e.g. a sandbox-fact). Appended only when --note is
# given, so the unaided baseline preamble stays clean and the delta is isolated.
# The note text is logged verbatim to meta.txt for the honesty column.
if [[ -n "$NOTE" ]]; then
  PROMPT="$PROMPT

$NOTE"
fi

# --- run dir ------------------------------------------------------------------
DATE="$(date +%Y-%m-%d)"
RUN_DIR="$PROBE_DIR/runs/${DATE}_${MODEL_TAG}_${METHOD}_${DATA}${LABEL:+_$LABEL}"
mkdir -p "$RUN_DIR"
SCRATCH="$ROOT/.scratch"
mkdir -p "$SCRATCH"; rm -f "$SCRATCH"/* 2>/dev/null || true   # /out starts empty

printf '%s' "$PROMPT" > "$RUN_DIR/prompt_sent.txt"
{
  echo "probe:      $PROBE"
  echo "data:       $DATA  ($SANDBOX_DATA)"
  echo "profile:    $PROFILE"
  echo "model_tag:  $MODEL_TAG"
  echo "method:     $METHOD"
  echo "note:       ${NOTE:-(none)}"
  echo "timestamp:  $(date -Is)"
  echo "git_sha:    $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  echo "hermes:     $(hermes --version 2>/dev/null | head -1)"
} > "$RUN_DIR/meta.txt"

# throughput stamp — measure THIS profile's server decode tok/s and log it
# every run (2026-05-31 audit decision: verify throughput as a side-effect of
# work we're doing anyway, so recorded numbers are measured not copied).
BASE_URL="$(grep -m1 'base_url:' "$HOME/.hermes/profiles/$PROFILE/config.yaml" 2>/dev/null | sed -E 's/.*base_url:[[:space:]]*//; s#/v1##; s#["'\'' ]##g')"
if [[ -n "$BASE_URL" ]]; then
  STAMP="$(curl -s --max-time 90 "$BASE_URL/completion" -H 'Content-Type: application/json' \
    -d '{"prompt":"Explain pump short-cycling in two sentences.","n_predict":128,"temperature":0.2,"cache_prompt":false}' 2>/dev/null \
    | python3 -c "import sys,json;d=json.load(sys.stdin);t=d.get('timings',{});print(f\"{t.get('predicted_per_second',0):.1f} tok/s decode / {t.get('prompt_per_second',0):.1f} tok/s prefill\")" 2>/dev/null || echo 'n/a')"
  echo "decode_stamp: $STAMP" >> "$RUN_DIR/meta.txt"
  echo "   throughput stamp ($BASE_URL): $STAMP"
fi

echo "## run_probe: $PROBE / $DATA / $PROFILE ($MODEL_TAG) / method=$METHOD"
echo "   run dir: $RUN_DIR"
echo "   [GPU touch on the profile's server — coordinate with Track B before firing]"
echo "   firing (timeout ${TIMEOUT}s)…"

# one-shot agent: terminal tool on, auto-approve commands, skip AGENTS/SOUL
# auto-injection so the only context is our de-leaked preamble + request.
START=$(date +%s)
timeout "$TIMEOUT" hermes -p "$PROFILE" -t terminal --yolo --ignore-rules \
  -z "$PROMPT" > "$RUN_DIR/transcript.log" 2>&1
RC=$?
END=$(date +%s)
echo "elapsed_s: $((END-START))" >> "$RUN_DIR/meta.txt"
echo "exit_code: $RC" >> "$RUN_DIR/meta.txt"

# harvest any artifacts the agent saved to /out
if compgen -G "$SCRATCH/*" > /dev/null; then
  cp -a "$SCRATCH"/* "$RUN_DIR/"
  echo "   harvested artifacts: $(ls "$SCRATCH" | tr '\n' ' ')"
fi

# recover the real answer from the Hermes session JSON — stdout is empty when a
# run ends on a tool call (2026-05-31 MoE finding). Writes answer.md +
# session_transcript.md; logs turn/tool counts to meta.txt.
SESS="$(ls -t "$HOME/.hermes/profiles/$PROFILE/sessions/"*.json 2>/dev/null | head -1)"
if [[ -n "$SESS" ]]; then
  SUMMARY="$(python3 scripts/extract_session.py "$SESS" "$RUN_DIR" 2>/dev/null || echo 'extract failed')"
  echo "session: $(basename "$SESS")" >> "$RUN_DIR/meta.txt"
  echo "session_summary: $SUMMARY" >> "$RUN_DIR/meta.txt"
  echo "   session: $SUMMARY"
fi

# Hermes prints the final answer to stdout. If the agent did not explicitly
# save output.md, keep a plain final-answer artifact (prefer the recovered
# answer.md over the possibly-empty stdout transcript).
if [[ ! -f "$RUN_DIR/output.md" ]]; then
  cp "$RUN_DIR/answer.md" "$RUN_DIR/output.md" 2>/dev/null || cp "$RUN_DIR/transcript.log" "$RUN_DIR/output.md"
fi

# Canonical chart name for the first probe's smoke checks.
if [[ "$PROBE" == "pump-cycling" && -f "$RUN_DIR/pump_level_plot.png" && ! -f "$RUN_DIR/level_vs_pump.png" ]]; then
  cp "$RUN_DIR/pump_level_plot.png" "$RUN_DIR/level_vs_pump.png"
fi

echo "   done (rc=$RC, $((END-START))s). transcript: $RUN_DIR/transcript.log"
echo "   --- transcript tail ---"
tail -n 25 "$RUN_DIR/transcript.log"
[[ $RC -eq 124 ]] && echo "   !! TIMED OUT at ${TIMEOUT}s — raise --timeout or check the server"
exit 0
