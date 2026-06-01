#!/usr/bin/env python3
"""Compute deterministic ground truth for the ph-control probe.

The operating band is derived FROM THE DATA, not from a textbook number. Real
SWaT stage-2 pH sits near 8.55 (the plant runs alkaline); a hardcoded drinking-
water band like [6.5, 8.5] would flag the majority of *normal* operation as an
excursion — the classic hidden-rubric trap (INSIGHTS #6). So we establish the
normal envelope robustly (median ± k·MAD-sigma, with a floor) and define a
control fault as a SUSTAINED, MATERIAL departure from that envelope — not a
single-sample blip or sensor transient. This mirrors the membrane probe's
significance gate (a real signal must be sustained and large, not just present).
"""
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

TAGS = ["AIT-202", "P-203"]

# Control-fault gate. Two independent triggers, the way operators actually think:
#   (1) SUSTAINED DRIFT — a contiguous excursion beyond the data-driven operating
#       band that is both long (>= min_minutes) and material (>= min_dev_ph). This
#       is "the loop stopped holding setpoint."
#   (2) ACUTE BREACH — any sample crossing a FIXED water-quality safety limit
#       (pH outside [acute_abs_low, acute_abs_high]), however brief. This is "a
#       slug of out-of-spec water reached the process," and a 3-minute dip to pH
#       6.0 counts (operator ruling, 2026-06-01 — see INSIGHTS #10).
# The data-driven band is for judging drift; the fixed limits are for acute safety.
# (The first lesson was not to use a textbook band for NORMAL-operation judgment;
# this adds it back ONLY as an acute floor/ceiling, a different job.)
GATE = {"min_minutes": 30.0, "min_dev_ph": 0.5, "envelope_k": 3.0,
        "envelope_floor": 0.3, "acute_abs_low": 6.5, "acute_abs_high": 9.0}


def operating_envelope(ph) -> tuple[float, float, float]:
    """Robust normal band: median ± max(k·MAD-sigma, floor)."""
    med = float(np.median(ph))
    mad = float(np.median(np.abs(ph - med)))
    sigma = 1.4826 * mad
    half = max(GATE["envelope_k"] * sigma, GATE["envelope_floor"])
    return med, med - half, med + half


def excursions(df, lo: float, hi: float):
    """Contiguous out-of-envelope runs, with wall-clock duration and peak dev."""
    ph = df["AIT-202"].to_numpy(dtype=float)
    ts = df["Timestamp"]
    oob = (ph < lo) | (ph > hi)
    events = []
    i = 0
    n = len(ph)
    while i < n:
        if not oob[i]:
            i += 1
            continue
        j = i
        while j < n and oob[j]:
            j += 1
        seg = ph[i:j]
        dur_min = (ts.iloc[j - 1] - ts.iloc[i]).total_seconds() / 60.0
        # peak deviation beyond whichever band edge it crossed
        dev = float(max((lo - seg.min()), (seg.max() - hi), 0.0))
        events.append({
            "start": ts.iloc[i].isoformat(),
            "end": ts.iloc[j - 1].isoformat(),
            "duration_min": round(dur_min, 1),
            "peak_dev_ph": round(dev, 3),
            "direction": "low" if seg.min() < lo else "high",
        })
        i = j
    return events


def main() -> None:
    default_data = os.path.normpath(
        os.path.join(HERE, "..", "..", "data", "stubs", "ph_control_v1.parquet")
    )
    p = argparse.ArgumentParser()
    p.add_argument("--data", default=default_data)
    p.add_argument("--out", default=os.path.join(HERE, "truth.json"))
    p.add_argument("--start", help="optional ISO timestamp lower bound")
    p.add_argument("--end", help="optional ISO timestamp upper bound")
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

    ph = df["AIT-202"].to_numpy(dtype=float)
    med, lo, hi = operating_envelope(ph)
    events = excursions(df, lo, hi)
    sustained = [e for e in events
                 if e["duration_min"] >= GATE["min_minutes"]
                 and e["peak_dev_ph"] >= GATE["min_dev_ph"]]
    # acute breach of a fixed water-quality limit, however brief
    acute_mask = (ph < GATE["acute_abs_low"]) | (ph > GATE["acute_abs_high"])
    acute_breach = bool(acute_mask.any())
    n_acute = int(acute_mask.sum())
    fault = bool(sustained) or acute_breach

    dosing_duty = float(df["P-203"].mean())  # canonical {0,1} after load.py

    truth = {
        "data_source": os.path.relpath(args.data, HERE),
        "span": {
            "start": df["Timestamp"].iloc[0].isoformat(),
            "end": df["Timestamp"].iloc[-1].isoformat(),
            "rows": int(len(df)),
            "hours": rep["span"]["hours"],
        },
        "operating_envelope": {
            "baseline_ph": round(med, 3),
            "band_low": round(lo, 3),
            "band_high": round(hi, 3),
            "note": "data-driven (median ± max(3·MAD-sigma, 0.3)), NOT a textbook band",
        },
        "metrics": {
            "ph_mean": round(float(ph.mean()), 4),
            "ph_min": round(float(ph.min()), 4),
            "ph_max": round(float(ph.max()), 4),
            "dosing_duty_pct": round(100.0 * dosing_duty, 2),
            "control_fault_detected": fault,
        },
        "tolerances": {
            "ph_mean_rel": 0.05,
            "ph_min_rel": 0.05,
            "ph_max_rel": 0.05,
            "dosing_duty_abs": 10.0,
        },
        "fault_gate": GATE,
        "fault_trigger": (
            "sustained_drift" if sustained and not acute_breach else
            "acute_breach" if acute_breach and not sustained else
            "both" if sustained and acute_breach else "none"
        ),
        "acute_breach_samples": n_acute,
        "excursions": events,
        "sustained_excursions": sustained,
    }

    with open(args.out, "w") as f:
        json.dump(truth, f, indent=2)
    print(f"[build_truth] band [{lo:.2f},{hi:.2f}] around {med:.2f}; "
          f"{len(events)} excursion(s), {len(sustained)} sustained, "
          f"{n_acute} acute-breach sample(s) "
          f"→ control_fault={fault} ({truth['fault_trigger']})")
    print(json.dumps(truth["metrics"], indent=2))


if __name__ == "__main__":
    main()
