#!/usr/bin/env python3
"""Grade membrane-fouling answers.json against truth.json.

Scoring is split into two tiers (2026-05-31 rubric-contract fix):

  GATING (decides PASS/FAIL) — the operational core, all unambiguously
  defined: did the agent read the data right and reach the right
  operational call?
    - dpit_slope_per_day   (raw pressure-rise trend)
    - fit_mean             (mean flow)
    - fouling_detected     (the operational verdict)

  INFORMATIONAL (reported, does NOT fail the run) — derived metrics whose
  definition is under-specified in the prompt, so an honest agent can
  compute a defensible-but-different number:
    - normalized_dpit_slope_per_day  (truth flow-normalizes as DPIT/FIT**2;
      the prompt does not say how to normalize)
    - dpit_change_pct                (truth uses edge-median windows; an
      endpoint-to-endpoint reading is equally valid)

We still compute and print these so divergence is visible — but until the
prompt pins their definition, scoring them PASS/FAIL would penalize honest
answers for a rubric ambiguity, not a capability gap. See INSIGHTS #3/#6.
The truth metrics themselves are unchanged.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

# operational core — these decide PASS/FAIL. Everything else is informational.
GATING = {"dpit_slope_per_day", "fit_mean", "fouling_detected"}


def rel_ok(answer, truth, tol):
    if answer is None:
        return False, None
    rel = abs(answer - truth) / max(abs(truth), 1e-9)
    return rel <= tol, round(rel, 4)


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--truth", required=True)
    p.add_argument("--answers", required=True)
    p.add_argument("--out", default="score.json")
    args = p.parse_args()

    with open(args.truth) as f:
        truth = json.load(f)
    if not os.path.exists(args.answers):
        result = {"ok": False, "reason": f"answers file missing: {args.answers}"}
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(json.dumps(result, indent=2))
        sys.exit(2)

    with open(args.answers) as f:
        ans = json.load(f)
    metrics = truth["metrics"]
    tol = truth["tolerances"]
    checks = {}

    # On cleaning-aware (sawtooth) truth the whole-window raw slope is meaningless
    # — the steady-state inter-clean trend is the real signal — so it drops out of
    # gating (the agent reports steady-state, the metric stores whole-window).
    gating = set(GATING)
    if truth.get("model") == "cleaning-aware":
        gating.discard("dpit_slope_per_day")

    for name, tol_name in (
        ("dpit_slope_per_day", "slope_rel"),
        ("normalized_dpit_slope_per_day", "normalized_slope_rel"),
        ("fit_mean", "fit_mean_rel"),
    ):
        ok, rel = rel_ok(ans.get(name), metrics[name], tol[tol_name])
        checks[name] = {
            "ok": ok,
            "gating": name in gating,
            "truth": metrics[name],
            "answer": ans.get(name),
            "rel_err": rel,
        }

    change_answer = ans.get("dpit_change_pct")
    change_ok = (
        change_answer is not None
        and abs(change_answer - metrics["dpit_change_pct"]) <= tol["change_pct_abs"]
    )
    checks["dpit_change_pct"] = {
        "ok": change_ok,
        "gating": "dpit_change_pct" in gating,
        "truth": metrics["dpit_change_pct"],
        "answer": change_answer,
    }

    checks["fouling_detected"] = {
        "ok": ans.get("fouling_detected") == metrics["fouling_detected"],
        "gating": "fouling_detected" in gating,
        "truth": metrics["fouling_detected"],
        "answer": ans.get("fouling_detected"),
    }

    # PASS/FAIL is decided by the gating (operational) checks only.
    gating_ok = all(c["ok"] for c in checks.values() if c["gating"])
    informational = {
        n: c for n, c in checks.items() if not c["gating"] and not c["ok"]
    }
    result = {
        "ok": gating_ok,
        "gating_checks": sorted(gating),
        "checks": checks,
    }
    if informational:
        result["informational_divergence"] = sorted(informational)
    with open(args.out, "w") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))
    sys.exit(0 if gating_ok else 1)


if __name__ == "__main__":
    main()
