#!/usr/bin/env python3
"""Grade ph-control answers.json against truth.json.

Two tiers, same contract as the membrane probe (INSIGHTS #3/#6):

  GATING (decides PASS/FAIL) — the operational core, unambiguously defined:
    - ph_mean                 (did it read the controlled variable right?)
    - control_fault_detected  (the operational verdict: is the loop in control?)

  INFORMATIONAL (reported, does NOT fail the run) — defensible-but-variable:
    - ph_min / ph_max         (raw vs operating-excursion-excluded readings differ)
    - dosing_duty_pct         (actuator duty — useful context, not the verdict)

The operating band is data-driven in truth (median ± MAD-sigma), so a control
fault is a SUSTAINED, MATERIAL excursion — not a textbook-band violation. An
agent that assumes a textbook band (e.g. 6.5-8.5) on alkaline-running real data
will over-call the verdict; that is exactly what the gating check catches.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

GATING = {"ph_mean", "control_fault_detected"}


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

    truth = json.load(open(args.truth))
    if not os.path.exists(args.answers):
        result = {"ok": False, "reason": f"answers file missing: {args.answers}"}
        json.dump(result, open(args.out, "w"), indent=2)
        print(json.dumps(result, indent=2))
        sys.exit(2)

    ans = json.load(open(args.answers))
    metrics = truth["metrics"]
    tol = truth["tolerances"]
    checks = {}

    for name, tol_name in (
        ("ph_mean", "ph_mean_rel"),
        ("ph_min", "ph_min_rel"),
        ("ph_max", "ph_max_rel"),
    ):
        ok, rel = rel_ok(ans.get(name), metrics[name], tol[tol_name])
        checks[name] = {
            "ok": ok,
            "gating": name in GATING,
            "truth": metrics[name],
            "answer": ans.get(name),
            "rel_err": rel,
        }

    duty_answer = ans.get("dosing_duty_pct")
    duty_ok = (
        duty_answer is not None
        and abs(duty_answer - metrics["dosing_duty_pct"]) <= tol["dosing_duty_abs"]
    )
    checks["dosing_duty_pct"] = {
        "ok": duty_ok,
        "gating": "dosing_duty_pct" in GATING,
        "truth": metrics["dosing_duty_pct"],
        "answer": duty_answer,
    }

    checks["control_fault_detected"] = {
        "ok": ans.get("control_fault_detected") is metrics["control_fault_detected"],
        "gating": "control_fault_detected" in GATING,
        "truth": metrics["control_fault_detected"],
        "answer": ans.get("control_fault_detected"),
    }

    gating_ok = all(c["ok"] for c in checks.values() if c["gating"])
    informational = {
        n: c for n, c in checks.items() if not c["gating"] and not c["ok"]
    }
    result = {
        "ok": gating_ok,
        "gating_checks": sorted(GATING),
        "checks": checks,
    }
    if informational:
        result["informational_divergence"] = sorted(informational)
    json.dump(result, open(args.out, "w"), indent=2)
    print(json.dumps(result, indent=2))
    sys.exit(0 if gating_ok else 1)


if __name__ == "__main__":
    main()
