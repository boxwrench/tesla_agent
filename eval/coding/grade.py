#!/usr/bin/env python3
"""Grade a coding-eval run: diff results JSON files vs ground-truth.json."""
import json
import re
import sys
from pathlib import Path
from datetime import datetime

# Path helper relative to this grader
EVAL_DIR = Path(__file__).resolve().parent

def norm_ts(s):
    s = str(s).strip().replace("T", " ").rstrip("Z").strip()
    return datetime.fromisoformat(s)

def close(a, b, tol=1e-6):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False

def load_json(p):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return None

def check_step1(got, exp):
    return (set(got.get("exceedances", [])) == set(exp["exceedances"])
            and got.get("count") == exp["count"])

def check_step2(got, exp):
    try:
        return (close(got.get("turbidity_max"), exp["turbidity_max"])
                and norm_ts(got.get("turbidity_max_ts")) == norm_ts(exp["turbidity_max_ts"])
                and got.get("ntu_breaches") == exp["ntu_breaches"]
                and got.get("turbidity_err_rows") == exp["turbidity_err_rows"]
                and got.get("missing_chlorine") == exp["missing_chlorine"])
    except Exception:
        return False

def check_step3(got, exp):
    try:
        return (got.get("statuses") == exp["statuses"]  # sequence order matters
                and norm_ts(got.get("err_ts")) == norm_ts(exp["err_ts"])
                and got.get("malformed_skipped") == exp["malformed_skipped"])
    except Exception:
        return False

def check_step4(got, exp):
    return (got.get("exceedance_count") == exp["exceedance_count"]
            and set(got.get("exceedances", [])) == set(exp["exceedances"])
            and got.get("turbidity_breach") == exp["turbidity_breach"]
            and got.get("pump_error") == exp["pump_error"]
            and got.get("claims_correlation") == exp["claims_correlation"])

def check_summary_fidelity(got, truth):
    """Check the specific incident-report facts in the summary."""
    summary = got.get("summary")
    if not isinstance(summary, str):
        return False

    text = summary.lower()
    expected_exceedances = {parameter.lower() for parameter in truth["step1"]["exceedances"]}
    
    lab_results = load_json(EVAL_DIR / "fixtures/lab_results.json") or {}
    non_exceedances = {
        item["parameter"].lower()
        for item in lab_results.get("results", [])
        if item["parameter"].lower() not in expected_exceedances
    }
    
    # Required mentions in text:
    # - The exceeding parameters from step 1
    # - Turbidity peak of 0.45 NTU on 2026-05-02
    # - Decoded pump status error on 2026-05-20
    required = [
        *(re.escape(parameter) for parameter in expected_exceedances),
        r"\b0\.45\b",
        r"\b2026-05-02\b",
        r"\bpump(?:_status)?\b",
        r"\berr(?:or)?\b",
        r"\b2026-05-20\b",
    ]
    
    if not all(re.search(pattern, text) for pattern in required):
        return False
        
    # Check that non-exceeding parameters are NOT falsely flagged as exceedances
    if any(re.search(rf"\b{re.escape(parameter)}\b", text) for parameter in non_exceedances):
        return False

    # Check for stating no proven correlation/link. "Absence" is included as
    # a noun-phrase negator, matching the prior malformed_skipped-style grader
    # broadening pattern: additive only, so it can convert false FAILs to PASS
    # without causing prior PASSes to fail.
    relation_term = r"(?:caus\w*|correl\w*|link\w*|relationship\w*|associat\w*)"
    negative_relation = (
        rf"(?:\bno\b|\bnot\b|\bwithout\b|\bcannot\b|\bcan't\b|\bdoes not\b|\babsence\b)"
        rf"[^.]*\b{relation_term}\b"
    )
    return bool(re.search(negative_relation, text))

def main():
    if len(sys.argv) != 2:
        print("Usage: grade.py <results_directory>", file=sys.stderr)
        sys.exit(2)
        
    rdir = Path(sys.argv[1]).resolve()
    if not rdir.is_dir():
        print(f"Error: Results directory not found at {rdir}", file=sys.stderr)
        sys.exit(1)
        
    truth_file = EVAL_DIR / "ground-truth.json"
    if not truth_file.exists():
        print(f"Error: Ground truth file not found at {truth_file}", file=sys.stderr)
        sys.exit(1)
        
    truth = json.loads(truth_file.read_text())
    results = {}
    
    # Check steps 1 to 3
    checks = {"step1": check_step1, "step2": check_step2, "step3": check_step3}
    for step in ("step1", "step2", "step3"):
        got = load_json(rdir / f"{step}.json")
        ok = bool(got) and checks[step](got, truth[step])
        results[step] = ok
        print(f"{step}: {'PASS' if ok else 'FAIL'}")

    # Check step 4
    step4 = load_json(rdir / "step4.json")
    structured = bool(step4) and check_step4(step4, truth["step4"])
    summary_fidelity = bool(step4) and check_summary_fidelity(step4, truth)
    results["step4"] = structured and summary_fidelity
    
    print(f"step4_structured: {'PASS' if structured else 'FAIL'}")
    print(f"summary_fidelity: {'PASS' if summary_fidelity else 'FAIL'}")
    print(f"step4: {'PASS' if results['step4'] else 'FAIL'}")

    e2e = all(results.values())
    print(f"e2e: {'PASS' if e2e else 'FAIL'}")
    sys.exit(0 if e2e else 1)

if __name__ == "__main__":
    main()
