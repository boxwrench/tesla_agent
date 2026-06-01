#!/usr/bin/env python3
"""Aggregate run artifacts into reliability + accuracy tables for REPORT.md.

Reliability = did the run complete and emit a gradeable answer? (does it break?)
Accuracy    = how close are the agent's gating numbers to ground truth? (is the
              inference meaningful and accurate?)

Reads each run dir's meta.txt (exit_code, elapsed_s, decode_stamp, session_summary)
and, where present, answers.json + score.json. No GPU, no network — pure post-hoc
aggregation, so it's cheap to re-run after every batch.

Usage:
  scripts/report_tables.py probes/membrane-fouling/runs/*real*   # globs allowed
  scripts/report_tables.py probes/membrane-fouling/runs/2026-06-01_*rel*
"""
from __future__ import annotations

import glob
import json
import os
import sys


def meta(run: str) -> dict:
    d = {}
    p = os.path.join(run, "meta.txt")
    if os.path.exists(p):
        for line in open(p):
            if ":" in line:
                k, _, v = line.partition(":")
                d[k.strip()] = v.strip()
    return d


def load(run: str, name: str):
    p = os.path.join(run, name)
    return json.load(open(p)) if os.path.exists(p) else None


def main() -> None:
    args = sys.argv[1:]
    runs = []
    for a in args:
        runs.extend(sorted(glob.glob(a)))
    runs = [r for r in runs if os.path.isdir(r)]
    if not runs:
        print("no run dirs matched", file=sys.stderr)
        sys.exit(1)

    # ---- reliability ---------------------------------------------------------
    print("## Reliability — did the run complete and emit a gradeable answer?\n")
    print("| Run | exit | elapsed | turns | answers.json | graded |")
    print("|---|---|---|---|---|---|")
    completed = 0
    for r in runs:
        m = meta(r)
        name = os.path.basename(r)
        exit_code = m.get("exit_code", "?")
        elapsed = m.get("elapsed_s", "?")
        summ = m.get("session_summary", "")
        turns = ""
        for tok in summ.split():
            if tok.startswith("turns="):
                turns = tok.split("=", 1)[1]
        ans = load(r, "answers.json")
        sc = load(r, "score.json")
        # "gradeable" = answers.json parsed and has the gating keys
        gradeable = bool(ans and "fouling_detected" in ans)
        graded = "ok" if (sc and sc.get("ok")) else ("FAIL" if sc else "—")
        if gradeable and exit_code == "0":
            completed += 1
        print(f"| {name} | {exit_code} | {elapsed}s | {turns} | "
              f"{'yes' if gradeable else 'NO'} | {graded} |")
    print(f"\n**Completion: {completed}/{len(runs)} runs produced a valid "
          f"gradeable answer at exit 0.**\n")

    # ---- accuracy ------------------------------------------------------------
    print("## Accuracy — agent's gating numbers vs ground truth\n")
    print("| Run | metric | truth | agent | rel-err | ok |")
    print("|---|---|---|---|---|---|")
    for r in runs:
        sc = load(r, "score.json")
        if not sc:
            continue
        name = os.path.basename(r)
        checks = sc.get("checks", {})
        for metric in ("dpit_slope_per_day", "fit_mean", "fouling_detected"):
            c = checks.get(metric)
            if not c:
                continue
            rel = c.get("rel_err")
            rel_s = "—" if rel is None else f"{rel:.4f}"
            print(f"| {name} | {metric} | {c.get('truth')} | "
                  f"{c.get('answer')} | {rel_s} | {'✓' if c.get('ok') else '✗'} |")


if __name__ == "__main__":
    main()
