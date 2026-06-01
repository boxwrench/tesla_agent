#!/usr/bin/env python3
"""integrity.py — the packing-slip check.

Before any analysis trusts a loaded dataset, confirm it is whole and
sane: right shape, continuous in time, values in plausible domains.
This is the cheap up-front gate that catches the *silent* wrong
answers (e.g. an actuator that turns out to be encoded {1,2}, or LIT
in mm where the rubric assumed percent) and the loud ones (truncated
download, a gap where the historian dropped out).

Two entry points:
  - report(df, tags)  -> dict of findings + flags (never raises)
  - assert_ok(report) -> raises if any blocking flag is present

Philosophy matches load.py: surface everything, decide loudly. The
report is meant to be printed and/or stored next to a run so a human
(or the agent) can see what the data actually is before trusting it.
"""
from __future__ import annotations
import argparse
import json
import os
import sys
import numpy as np
import pandas as pd

# A discrete actuator should resolve to exactly the two canonical
# states after normalization. Anything else is a flag.
_CANONICAL_ACTUATOR_STATES = {0, 1}


def _role(tag: str) -> str:
    from load import is_actuator
    return "actuator" if is_actuator(tag) else "analog"


def report(df: pd.DataFrame, tags: list[str]) -> dict:
    """Compute an integrity report over a loaded, normalized frame."""
    ts = pd.DatetimeIndex(df["Timestamp"])
    dt = ts.to_series().diff().dt.total_seconds().dropna()
    median_dt = float(dt.median()) if len(dt) else float("nan")
    # A "gap" is a step more than 1.5x the normal cadence.
    gap_mask = dt > (1.5 * median_dt) if median_dt == median_dt else dt > 0
    n_gaps = int(gap_mask.sum())
    max_gap = float(dt.max()) if len(dt) else float("nan")

    flags: list[str] = []
    if not ts.is_monotonic_increasing:
        flags.append("timestamps not monotonic after sort")
    n_dup = int(ts.duplicated().sum())
    if n_dup:
        flags.append(f"{n_dup} duplicate timestamps")

    tag_info: dict[str, dict] = {}
    enc = df.attrs.get("encodings", {})
    for tag in tags:
        col = df[tag]
        role = _role(tag)
        distinct = sorted({float(v) for v in col.dropna().unique()})[:8]
        info = {
            "role": role,
            "min": float(col.min()),
            "max": float(col.max()),
            "n_distinct": int(col.nunique()),
            "n_null": int(col.isna().sum()),
        }
        if role == "actuator":
            states = {int(v) for v in col.dropna().unique()}
            info["states"] = sorted(states)
            info["encoding_detected"] = enc.get(tag, "unknown")
            if not states <= _CANONICAL_ACTUATOR_STATES:
                flags.append(
                    f"{tag}: not canonical {{0,1}} after normalization "
                    f"(states={sorted(states)}) — value normalization missing?"
                )
        else:
            info["distinct_sample"] = distinct
            # Heuristic unit hint: a percent-scaled level maxes <= ~105.
            if tag.startswith("LIT"):
                info["unit_hint"] = "percent" if info["max"] <= 105 else "engineering (e.g. mm)"
        if info["n_null"] > 0:
            flags.append(f"{tag}: {info['n_null']} null values")
        tag_info[tag] = info

    return {
        "rows": int(len(df)),
        "span": {
            "start": ts.min().isoformat(),
            "end": ts.max().isoformat(),
            "hours": round((ts.max() - ts.min()).total_seconds() / 3600.0, 2),
        },
        "cadence": {
            "median_dt_s": median_dt,
            "n_gaps_gt_1p5x": n_gaps,
            "max_gap_s": max_gap,
        },
        "tags": tag_info,
        "flags": flags,
    }


def assert_ok(rep: dict, allow: list[str] | None = None) -> None:
    """Raise if the report has blocking flags. `allow` lists substrings
    of flags that are acceptable for this dataset (e.g. a known gap)."""
    allow = allow or []
    blocking = [f for f in rep["flags"]
                if not any(a.lower() in f.lower() for a in allow)]
    if blocking:
        raise ValueError("integrity check failed:\n  - " + "\n  - ".join(blocking))


def main():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from load import load_tags
    p = argparse.ArgumentParser(description="integrity report for a data file")
    p.add_argument("path")
    p.add_argument("--tags", nargs="+", default=["LIT-101", "P-101"])
    p.add_argument("--strict", action="store_true", help="exit 1 if any flag")
    args = p.parse_args()

    df = load_tags(args.path, args.tags)
    rep = report(df, args.tags)
    print(json.dumps(rep, indent=2))
    if args.strict and rep["flags"]:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
