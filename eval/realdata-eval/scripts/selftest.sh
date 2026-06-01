#!/usr/bin/env bash
set -uo pipefail
# selftest.sh — fast (<1s, no GPU) regression guard for the harness + scorers.
# Guards two real bugs fixed 2026-05-31:
#   1. run_probe.sh request extraction was case-sensitive ("## The request" vs
#      "## The Request") → membrane extracted an EMPTY question. Assert every
#      probe's prompt.md yields a non-empty request through the same awk.
#   2. membrane score.py must gate PASS/FAIL on the operational core only:
#      a fully-correct answer PASSES; a wrong fouling call FAILS — even though
#      the two informational metrics are ignored for gating.
# Run from anywhere: docs/projects/realdata-eval/scripts/selftest.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail=0
note() { printf '  %-6s %s\n' "$1" "$2"; }

echo "## selftest: prompt extraction (guards the case-sensitivity bug)"
for pd in probes/*/; do
  [[ -f "$pd/prompt.md" ]] || continue
  # mirror run_probe.sh's REQUEST extraction (case-insensitive header)
  req="$(awk 'tolower($0) ~ /^## the request/{f=1;next} /^## /{if(f)f=0} f&&/^>/{sub(/^> ?/,"");print}' "$pd/prompt.md")"
  if [[ -n "$req" ]]; then
    note "PASS" "${pd#probes/} request extracts (${#req} chars)"
  else
    note "FAIL" "${pd#probes/} request is EMPTY — extraction regressed"; fail=1
  fi
done

echo "## selftest: membrane scorer gate (guards operational-core gating)"
mtruth="probes/membrane-fouling/truth.json"
if [[ -f "$mtruth" ]]; then
  tmpd="$(mktemp -d)"
  # fully-correct (mirror truth's gating metrics) → expect PASS / exit 0
  python3 - "$mtruth" "$tmpd/good.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))["metrics"]
json.dump({
    "dpit_slope_per_day": m["dpit_slope_per_day"],
    "normalized_dpit_slope_per_day": 0.0,   # deliberately wrong (informational)
    "fit_mean": m["fit_mean"],
    "dpit_change_pct": 0.0,                  # deliberately wrong (informational)
    "fouling_detected": m["fouling_detected"],
}, open(sys.argv[2], "w"))
PY
  python3 probes/membrane-fouling/score.py --truth "$mtruth" --answers "$tmpd/good.json" --out "$tmpd/good_score.json" >/dev/null 2>&1
  [[ $? -eq 0 ]] && note "PASS" "operational-correct answer passes the gate (informational misses ignored)" \
                 || { note "FAIL" "operational-correct answer did NOT pass — gate too strict"; fail=1; }

  # wrong fouling call → expect FAIL / exit 1
  python3 - "$mtruth" "$tmpd/bad.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))["metrics"]
json.dump({
    "dpit_slope_per_day": m["dpit_slope_per_day"],
    "normalized_dpit_slope_per_day": m["normalized_dpit_slope_per_day"],
    "fit_mean": m["fit_mean"],
    "dpit_change_pct": m["dpit_change_pct"],
    "fouling_detected": (not m["fouling_detected"]),  # wrong verdict
}, open(sys.argv[2], "w"))
PY
  python3 probes/membrane-fouling/score.py --truth "$mtruth" --answers "$tmpd/bad.json" --out "$tmpd/bad_score.json" >/dev/null 2>&1
  [[ $? -eq 1 ]] && note "PASS" "wrong fouling call fails the gate" \
                 || { note "FAIL" "wrong fouling call did NOT fail — gate too loose"; fail=1; }
  rm -rf "$tmpd"
else
  note "SKIP" "membrane truth.json not found"
fi

echo "## selftest: ph-control scorer gate (data-driven band, fault verdict)"
ptruth="probes/ph-control/truth.json"
if [[ -f "$ptruth" ]]; then
  tmpd="$(mktemp -d)"
  # operational-correct (right mean + right verdict) → PASS
  python3 - "$ptruth" "$tmpd/good.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))["metrics"]
json.dump({
    "ph_mean": m["ph_mean"],
    "ph_min": 0.0,                # deliberately wrong (informational)
    "ph_max": 0.0,                # deliberately wrong (informational)
    "dosing_duty_pct": 0.0,       # deliberately wrong (informational)
    "control_fault_detected": m["control_fault_detected"],
}, open(sys.argv[2], "w"))
PY
  python3 probes/ph-control/score.py --truth "$ptruth" --answers "$tmpd/good.json" --out "$tmpd/g.json" >/dev/null 2>&1
  [[ $? -eq 0 ]] && note "PASS" "operational-correct answer passes (informational misses ignored)" \
                 || { note "FAIL" "operational-correct answer did NOT pass — gate too strict"; fail=1; }
  # wrong control verdict → FAIL
  python3 - "$ptruth" "$tmpd/bad.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))["metrics"]
json.dump({
    "ph_mean": m["ph_mean"], "ph_min": m["ph_min"], "ph_max": m["ph_max"],
    "dosing_duty_pct": m["dosing_duty_pct"],
    "control_fault_detected": (not m["control_fault_detected"]),  # wrong verdict
}, open(sys.argv[2], "w"))
PY
  python3 probes/ph-control/score.py --truth "$ptruth" --answers "$tmpd/bad.json" --out "$tmpd/b.json" >/dev/null 2>&1
  [[ $? -eq 1 ]] && note "PASS" "wrong control verdict fails the gate" \
                 || { note "FAIL" "wrong control verdict did NOT fail — gate too loose"; fail=1; }
  rm -rf "$tmpd"
else
  note "SKIP" "ph-control truth.json not found"
fi

echo
[[ $fail -eq 0 ]] && echo "selftest: ALL PASS" || echo "selftest: FAILURES above"
exit $fail
