#!/usr/bin/env python3
"""Compute deterministic ground truth for the membrane-fouling probe."""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
PUMP_PROBE = os.path.normpath(os.path.join(HERE, "..", "pump-cycling"))
sys.path.insert(0, PUMP_PROBE)

from load import load_tags  # noqa: E402
import integrity  # noqa: E402

TAGS = ["DPIT-301", "FIT-301"]


def slope_per_day(ts, values) -> float:
    days = (ts - ts.iloc[0]).dt.total_seconds().to_numpy() / 86400.0
    return float(np.polyfit(days, values.to_numpy(dtype=float), 1)[0])


def edge_change_pct(values) -> float:
    n = max(10, int(len(values) * 0.10))
    start = float(values.iloc[:n].median())
    end = float(values.iloc[-n:].median())
    return 100.0 * (end - start) / start


def segment_cleanings(df):
    """Real cyclically-cleaned membranes are sawtooth: DPIT climbs, then a CIP
    backwash crashes it down. A single whole-window slope is meaningless on that.
    Split operating (steady) points from cleaning excursions, count the cleanings,
    and measure fouling as the *inter-clean steady-state* DPIT trend.

    operating point := DPIT above half its median (well above the crash floor,
    below the steady band). A cleaning := one contiguous below-threshold run.
    """
    dpit = df["DPIT-301"]
    thr = 0.5 * float(dpit.median())
    operating = (dpit > thr).to_numpy()
    # count contiguous below-threshold runs = cleaning events
    below = ~operating
    cleanings = int(np.sum(below[1:] & ~below[:-1])) + int(below[0])
    op = df[operating].reset_index(drop=True)
    days = (op["Timestamp"] - op["Timestamp"].iloc[0]).dt.total_seconds().to_numpy() / 86400.0
    y = op["DPIT-301"].to_numpy(dtype=float)
    slope, intercept = np.polyfit(days, y, 1)
    pred = slope * days + intercept
    ss_res = float(np.sum((y - pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    span_days = float(days[-1] - days[0])
    return {
        "threshold_bar": round(thr, 3),
        "cleaning_events": cleanings,
        "operating_fraction": round(float(operating.mean()), 4),
        "steady_state_dpit_slope_per_day": round(float(slope), 4),
        "steady_state_r2": round(float(r2), 4),
        "modeled_rise_bar": round(float(slope) * span_days, 4),
        "window_hours": round(span_days * 24.0, 2),
    }


def main() -> None:
    default_data = os.path.normpath(
        os.path.join(HERE, "..", "..", "data", "stubs", "membrane_fouling_v1.parquet")
    )
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=default_data)
    p.add_argument("--out", default=os.path.join(HERE, "truth.json"))
    p.add_argument("--start", help="optional ISO timestamp lower bound")
    p.add_argument("--end", help="optional ISO timestamp upper bound")
    p.add_argument("--min-flow", type=float, default=0.5)
    p.add_argument("--segment-cleanings", action="store_true",
                   help="real-data mode: split CIP cleanings from steady state "
                        "and grade fouling on the inter-clean trend")
    args = p.parse_args()

    df = load_tags(args.data, TAGS)
    if args.start:
        df = df[df["Timestamp"] >= args.start]
    if args.end:
        df = df[df["Timestamp"] <= args.end]
    df = df.reset_index(drop=True)

    rep = integrity.report(df, TAGS)
    integrity.assert_ok(rep)
    print("[build_truth] integrity OK — "
          f"{rep['rows']:,} rows, {rep['span']['hours']}h")

    usable = df[df["FIT-301"] >= args.min_flow].copy()
    if len(usable) < 20:
        raise ValueError(
            f"not enough rows with FIT-301 >= {args.min_flow}: {len(usable)}"
        )
    usable["DPIT_norm"] = usable["DPIT-301"] / (usable["FIT-301"] ** 2)

    dpit_slope = slope_per_day(usable["Timestamp"], usable["DPIT-301"])
    norm_slope = slope_per_day(usable["Timestamp"], usable["DPIT_norm"])
    change_pct = edge_change_pct(usable["DPIT-301"])

    truth = {
        "data_source": os.path.relpath(args.data, HERE),
        "span": {
            "start": df["Timestamp"].iloc[0].isoformat(),
            "end": df["Timestamp"].iloc[-1].isoformat(),
            "rows": int(len(df)),
            "usable_rows": int(len(usable)),
            "hours": rep["span"]["hours"],
        },
        "metrics": {
            "dpit_slope_per_day": round(dpit_slope, 4),
            "normalized_dpit_slope_per_day": round(norm_slope, 4),
            "fit_mean": round(float(usable["FIT-301"].mean()), 4),
            "dpit_change_pct": round(change_pct, 2),
            "fouling_detected": bool(dpit_slope > 0.25 and change_pct > 10.0),
        },
        "tolerances": {
            "slope_rel": 0.10,
            "normalized_slope_rel": 0.10,
            "fit_mean_rel": 0.05,
            "change_pct_abs": 5.0,
        },
    }

    if args.segment_cleanings:
        seg = segment_cleanings(df)
        truth["model"] = "cleaning-aware"
        truth["cleaning"] = seg
        # Fouling = a steady inter-clean trend that is real (slope), trustworthy
        # (R²), material (absolute rise), and seen over a long-enough horizon —
        # not a bare slope threshold. A 6h window fails the horizon by design:
        # fouling is a multi-day process you can't confirm in hours.
        gate = {"min_slope": 0.5, "min_r2": 0.5, "min_rise_bar": 1.0, "min_hours": 24.0}
        truth["fouling_gate"] = gate
        truth["metrics"]["fouling_detected"] = bool(
            seg["steady_state_dpit_slope_per_day"] > gate["min_slope"]
            and seg["steady_state_r2"] > gate["min_r2"]
            and seg["modeled_rise_bar"] >= gate["min_rise_bar"]
            and seg["window_hours"] >= gate["min_hours"]
        )
        print(f"[build_truth] cleaning-aware: {seg['cleaning_events']} cleanings, "
              f"steady slope {seg['steady_state_dpit_slope_per_day']}/day, "
              f"R²={seg['steady_state_r2']}, {seg['window_hours']}h "
              f"→ fouling={truth['metrics']['fouling_detected']}")
    with open(args.out, "w") as f:
        json.dump(truth, f, indent=2)
    print(json.dumps(truth, indent=2))


if __name__ == "__main__":
    main()
