#!/usr/bin/env python3
"""score.py — grade an agent's answers.json against truth.json.

Numeric checks only. The free-text recommendation field is graded in
a separate human pass.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
from datetime import datetime, timedelta


def parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def windows_overlap(truth_w, ans_w, slack_min: int) -> bool:
    a0 = parse_iso(truth_w["start_ts"]) - timedelta(minutes=slack_min)
    a1 = parse_iso(truth_w["end_ts"]) + timedelta(minutes=slack_min)
    b0 = parse_iso(ans_w["start_ts"])
    b1 = parse_iso(ans_w["end_ts"])
    return not (b1 < a0 or b0 > a1)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--truth", required=True)
    p.add_argument("--answers", required=True, help="agent's answers.json")
    p.add_argument("--out", default="score.json")
    args = p.parse_args()

    truth = json.load(open(args.truth))
    if not os.path.exists(args.answers):
        result = {"ok": False, "reason": f"answers file missing: {args.answers}"}
        json.dump(result, open(args.out, "w"), indent=2)
        print(json.dumps(result, indent=2)); sys.exit(2)

    ans = json.load(open(args.answers))
    tol = truth["tolerances"]
    checks: dict = {}

    # starts/hour
    sph_truth = truth["starts_per_hour_overall"]
    sph_ans = ans.get("starts_per_hour")
    if sph_ans is None:
        checks["starts_per_hour"] = {"ok": False, "reason": "missing"}
    else:
        rel = abs(sph_ans - sph_truth) / max(sph_truth, 1e-9)
        checks["starts_per_hour"] = {
            "ok": rel <= tol["starts_per_hour_rel"],
            "truth": sph_truth, "answer": sph_ans, "rel_err": round(rel, 4),
        }

    # band
    lo_t = truth["level_band"]["low_pct"]
    hi_t = truth["level_band"]["high_pct"]
    lo_a = (ans.get("level_band") or {}).get("low_pct")
    hi_a = (ans.get("level_band") or {}).get("high_pct")
    band_ok = (
        lo_a is not None and hi_a is not None
        and abs(lo_a - lo_t) <= tol["band_pct_abs"]
        and abs(hi_a - hi_t) <= tol["band_pct_abs"]
    )
    checks["level_band"] = {
        "ok": band_ok,
        "truth": [lo_t, hi_t], "answer": [lo_a, hi_a],
    }

    # short-cycle windows: each truth window must overlap some answer window
    truth_windows = truth.get("short_cycle_windows", [])
    ans_windows = ans.get("short_cycle_windows", []) or []
    matched = []
    for tw in truth_windows:
        hit = any(windows_overlap(tw, aw, tol["short_cycle_window_minutes"])
                  for aw in ans_windows)
        matched.append({"truth": tw, "matched": hit})
    sc_ok = len(truth_windows) == 0 or all(m["matched"] for m in matched)
    checks["short_cycle_windows"] = {
        "ok": sc_ok,
        "expected": len(truth_windows),
        "reported": len(ans_windows),
        "matches": matched,
    }

    overall_ok = all(c["ok"] for c in checks.values())
    result = {"ok": overall_ok, "checks": checks}
    json.dump(result, open(args.out, "w"), indent=2)
    print(json.dumps(result, indent=2))
    sys.exit(0 if overall_ok else 1)


if __name__ == "__main__":
    main()
