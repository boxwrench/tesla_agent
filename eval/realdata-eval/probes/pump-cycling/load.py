#!/usr/bin/env python3
"""load.py — the normalization layer.

Real plant historian exports are messy: tags named `LIT101` here and
`LIT-101` there, leading spaces in headers, a BOM at the start of the
file, day-first 12-hour timestamps. The stub we generate is clean.
Both flow through this one function so the rest of the probe never has
to care which it got.

Design choice — DELIBERATELY brittle, LOUD failure:
  We use a structural rule (strip, upper, hyphenate letter↔digit) that
  collapses the common messiness, then ASSERT every requested tag was
  found. We do NOT fuzzy-match. A name we can't resolve raises rather
  than silently mapping to the wrong instrument — because in a plant
  context, reading the wrong tag is worse than failing to read.
  When a genuinely new format breaks this, that's a one-line, eyes-open
  addition — not a silent miscalibration.
"""
from __future__ import annotations
import re
import os
import pandas as pd

_TS_ALIASES = {"timestamp", "time", "datetime", "date time", "date_time"}
_INSTRUMENT = re.compile(r"^([A-Za-z]+)[-_ ]?0*(\d+)$")

# Known explicit timestamp formats, tried in order. Explicit beats
# inference: it fixes ambiguous stragglers correctly instead of
# silently coercing them to NaT. SWaT uses day-first, 12-hour AM/PM.
_TS_FORMATS = (
    "%d/%m/%Y %I:%M:%S %p",   # 28/12/2015 10:00:00 AM  (SWaT)
    "%d/%m/%Y %H:%M:%S",      # 24-hour variant
    "%Y-%m-%d %H:%M:%S",      # ISO-ish (stub, most historians)
)

# Discrete actuator tags (pumps, motorized valves, UV) — canonical
# state is {0=off/closed, 1=on/open}. Real SWaT historian encodes them
# as {1=off, 2=on} (and 0=transitioning). The stub already uses {0,1}.
# We normalize to {0,1}; see normalize_actuator for the loud/ambiguous
# policy.
_ACTUATOR_PREFIXES = ("P", "MV", "UV")


def is_actuator(tag: str) -> bool:
    return tag.split("-")[0] in _ACTUATOR_PREFIXES


def normalize_actuator(s: pd.Series, tag: str) -> tuple[pd.Series, str]:
    """Map a discrete actuator column to canonical {0=off, 1=on}.

    Returns (normalized_series, detected_encoding). Policy:
      - {0,1}        -> passthrough          (encoding "01")
      - {1,2}        -> 1->0, 2->1           (encoding "swat12")
      - {0,1,2}      -> 2->1, 1->0, 0(transition)->hold previous (encoding "swat012")
      - anything else-> raise (loud)         — unknown encoding
      - a SINGLE-valued column ({1} or {2} or {0}) is AMBIGUOUS between
        schemes; we cannot tell "always off" from "always on", so we
        raise rather than silently guess. Pass an unambiguous slice or
        widen the window.
    """
    vals = {int(v) for v in s.dropna().unique()}
    if len(vals) == 1:
        raise ValueError(
            f"{tag}: single-state actuator (values={sorted(vals)}) — encoding is "
            f"ambiguous (can't tell off from on). Use a window where it cycles."
        )
    if vals <= {0, 1}:
        return s.astype("int8"), "01"
    if vals <= {1, 2}:
        return (s.astype("int8") - 1), "swat12"
    if vals <= {0, 1, 2}:
        mapped = s.astype("int8").map({1: 0, 2: 1})
        # 0 = transitioning: hold the previous settled state.
        mapped = mapped.where(s.astype("int8") != 0).ffill().fillna(0).astype("int8")
        return mapped, "swat012"
    raise ValueError(
        f"{tag}: unknown actuator encoding, values={sorted(vals)} — refusing to "
        f"guess. Add an explicit rule in normalize_actuator if this is real."
    )


def canonical_name(raw: str) -> str:
    """Map one possibly-messy column name to its canonical form.

    'LIT101' -> 'LIT-101' ; ' LIT-101 ' -> 'LIT-101' ; ' Timestamp' -> 'Timestamp'
    """
    s = raw.replace("﻿", "").strip()
    if s.lower().replace("_", " ").strip() in _TS_ALIASES:
        return "Timestamp"
    m = _INSTRUMENT.match(s)
    if m:
        return f"{m.group(1).upper()}-{int(m.group(2))}"
    return s.upper()


def _parse_timestamps(s: pd.Series):
    """Parse a timestamp column with explicit formats first, inference
    only as a last resort. Returns (parsed_series, bad_fraction)."""
    if pd.api.types.is_datetime64_any_dtype(s):
        return s, 0.0
    s = s.astype(str).str.strip()
    best = None
    for fmt in _TS_FORMATS:
        parsed = pd.to_datetime(s, format=fmt, errors="coerce")
        if best is None or parsed.notna().sum() > best.notna().sum():
            best = parsed
        if parsed.notna().all():
            return parsed, 0.0
    # Inference only for the residue the explicit formats missed.
    if best.isna().any():
        resid = pd.to_datetime(s[best.isna()], errors="coerce", dayfirst=True)
        best.loc[resid.index] = resid
    return best, float(best.isna().mean())


def load_tags(path: str, tags: list[str], max_bad_frac: float = 0.01,
              normalize_values: bool = True) -> pd.DataFrame:
    """Load `Timestamp` + the requested canonical tags from a CSV or
    parquet file, normalizing column names, timestamps, and (when
    `normalize_values`) discrete actuator encodings.

    Error-correction policy:
      - Column names are normalized structurally (no fuzzy matching).
      - Timestamps are parsed by explicit format; a tiny residue of
        unparseable rows is QUARANTINED (dropped + counted), not
        silently kept.
      - Actuator tags (P*/MV*/UV*) are mapped to canonical {0,1};
        unknown or single-state encodings raise (loud) rather than
        guess. See normalize_actuator.
      - If the bad fraction exceeds `max_bad_frac`, raise (loud) —
        many bad rows means a structural change, not a stray cell.

    The result carries `df.attrs["encodings"]` = {tag: detected_encoding}
    so callers can see what value normalization did — never silent.

    Raises KeyError (loud) if any requested tag is absent after
    normalization — that is the intended safety behavior.
    """
    ext = os.path.splitext(path)[1].lower()

    if ext in (".parquet", ".pq"):
        df = pd.read_parquet(path)
        df = df.rename(columns={c: canonical_name(str(c)) for c in df.columns})
    elif ext in (".csv", ".txt"):
        # Peek at the header so we only read the columns we need from a
        # large file. encoding-sig strips a BOM if present.
        header = pd.read_csv(path, nrows=0, encoding="utf-8-sig")
        rename = {c: canonical_name(str(c)) for c in header.columns}
        canon_to_raw: dict[str, str] = {}
        for raw, canon in rename.items():
            canon_to_raw.setdefault(canon, raw)
        wanted_raw = [canon_to_raw[t] for t in (["Timestamp"] + tags) if t in canon_to_raw]
        df = pd.read_csv(path, usecols=wanted_raw, encoding="utf-8-sig")
        df = df.rename(columns={c: canonical_name(str(c)) for c in df.columns})
    else:
        raise ValueError(f"unsupported file type: {ext} ({path})")

    missing = [t for t in (["Timestamp"] + tags) if t not in df.columns]
    if missing:
        raise KeyError(
            f"normalization could not find {missing} in {os.path.basename(path)}; "
            f"available canonical columns: {sorted(df.columns)[:30]}"
        )

    parsed, bad_frac = _parse_timestamps(df["Timestamp"])
    df["Timestamp"] = parsed
    n_bad = int(df["Timestamp"].isna().sum())
    if bad_frac > max_bad_frac:
        raise ValueError(
            f"{n_bad} timestamps ({bad_frac:.2%}) unparseable in "
            f"{os.path.basename(path)} — exceeds max_bad_frac={max_bad_frac:.2%}. "
            f"Likely a structural change, not stray cells."
        )
    if n_bad:
        # Quarantine: drop the handful, but say so — never silent.
        print(f"[load_tags] quarantined {n_bad} unparseable-timestamp row(s) "
              f"({bad_frac:.4%}) from {os.path.basename(path)}")
        df = df[df["Timestamp"].notna()]

    out = df[["Timestamp"] + tags].sort_values("Timestamp").reset_index(drop=True)

    # Value/semantic normalization: discrete actuators -> canonical {0,1}.
    encodings: dict[str, str] = {}
    if normalize_values:
        for tag in tags:
            if is_actuator(tag):
                out[tag], enc = normalize_actuator(out[tag], tag)
                encodings[tag] = enc
                if enc != "01":
                    print(f"[load_tags] {tag}: re-encoded {enc} -> canonical {{0,1}}")
    out.attrs["encodings"] = encodings
    return out


if __name__ == "__main__":
    import argparse, sys
    p = argparse.ArgumentParser(description="smoke-test the normalizer on a file")
    p.add_argument("path")
    p.add_argument("--tags", nargs="+", default=["LIT-101", "P-101"])
    args = p.parse_args()
    df = load_tags(args.path, args.tags)
    print(f"loaded {len(df):,} rows from {os.path.basename(args.path)}")
    print(f"columns: {list(df.columns)}")
    print(f"span   : {df['Timestamp'].min()} -> {df['Timestamp'].max()}")
    print(df.head(3).to_string(index=False))
    sys.exit(0)
