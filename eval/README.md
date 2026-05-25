# Evaluation Framework

To run a reliable local agentic system, you must be able to verify that your model can act safely and accurately. This directory packages the dual-battery evaluation framework used to test local models on unified memory hardware.

Rather than relying on generic academic benchmarks (like MMLU or HumanEval), we test models directly on domain-specific workloads.

---

## The Dual-Battery Approach

Evaluating local agentic AI requires measuring two completely separate capabilities:

```
                      ┌──────────────────────────────┐
                      │    Evaluation Framework      │
                      └──────────────┬───────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
┌───────────────────────────┐                 ┌───────────────────────────┐
│     Coding Evaluation     │                 │    Quality Evaluation     │
│       (eval/coding/)      │                 │      (eval/quality/)      │
├───────────────────────────┤                 ├───────────────────────────┤
│ • Objective verification  │                 │ • Subjective planning     │
│ • State-carrying tool-use │                 │ • 7-Dimension Rubric      │
│ • Messy log/data analysis │                 │ • Fabrication-resistance  │
│ • Binary Pass/Fail        │                 │ • Graded Scorecard        │
└───────────────────────────┘                 └───────────────────────────┘
```

### 1. Coding & Tool Reliability (Objective)
* **What it measures:** Can the model execute tools in sequence, carry state across 4 dependencies, handle parsing errors, and output formatted JSON without hallucinating commands?
* **Why it matters:** If the model prints code as text (e.g. ```bash cat log.txt```) instead of calling the terminal tool, the agent loop stalls. If it cannot read logs without crashing, it is useless in operations.
* **Harness:** Run via `scripts/eval/run_coding_eval.sh`. Graded automatically by a Python script against committed ground-truth answers.

### 2. Planning & Research Quality (Subjective)
* **What it measures:** When asked to write a research brief, scope a project, or sequence capital projects, does the model generate deep, logical, and structured text without fabricating facts?
* **Why it matters:** Quantization can cause models to hallucinate specific percentages, costs, or chemical standards (e.g., inventing EPA regulatory dates). In utility work, a single confident fabrication is disqualifying.
* **Harness:** Run the 6 fixed prompts under `eval/quality/prompts/` and grade the outputs using the 7-dimension rubric scorecard.

---

## File Layout

* `eval/coding/`
  * `fixtures/` — Messy telemetry SCADA CSVs, lab results JSON, and hex-payload server logs.
  * `tasks.md` — Detailed step descriptions for the 4-step sequence.
  * `ground-truth.json` — The correct answers for automated grading.
  * `grade.py` — Pure-Python grading engine.
  * `design.md` — Rationale and trap descriptions.
* `eval/quality/`
  * `eval-design.md` — The 7-dimension quality rubric.
  * `scorecard-template.md` — Scorecard template for comparing models side-by-side.
  * `prompts/` — The 6 domain prompts (P1 to P6).
