# Coding Evaluation Design

This document details the engineering methodology behind the 4-step coding evaluation. It explains the specific traps embedded in the datasets and the lessons learned from verifying the grader itself.

---

## 1. Embedded Traps & Testing Axes

The coding evaluation is not just a syntax check; it tests the agent's ability to handle messy, real-world data and maintain logical discipline across multiple steps.

### **Trap A: Hex Payload Decoding (Step 3)**
* **The setup:** In `server_logs.txt`, the `PUMP_STATUS` events carry a hex-encoded payload, e.g.:
  `[2026-05-20 08:25:10] EVENT: PUMP_STATUS | PAYLOAD: 0x455252 (Status: Error)`
* **The trap:** The status is only correct if you decode the payload. `0x455252` decodes to `ERR`, `0x4F4E` to `ON`, `0x4F4646` to `OFF`, `0x52554E` to `RUN`. A model that regex-scrapes the line will also have to strip the `0x` prefix correctly.
* **What it measures:** Will the model write a script to decode the hex value (e.g. `bytes.fromhex("455252").decode()`), or will it lazily lift the parenthetical `(Status: …)` annotation as the answer? The grader requires the **decoded** statuses in log order, so guessing from the annotation produces the wrong casing/values and fails.

### **Trap B: Messy Telemetry & Empty Fields (Step 2)**
* **The setup:** In `scada_raw.csv`, some rows in the turbidity column contain the string `"ERR"`, and some rows in the chlorine column are completely blank.
* **The trap:** A simple Python csv loop using `float(row['turbidity_ntu'])` will crash with a `ValueError`.
* **What it measures:** Can the model write robust error-handling code (using `try/except` blocks or checking for non-numeric strings) to skip bad data rows while correctly compiling statistics?

### **Trap C: The Correlation Mismatch (Step 4)**
* **The setup:** The SCADA telemetry covers early May (05-01 to 05-03), the lab results are sampled mid-May (05-15), and the pump error occurs on May 20 — three non-overlapping date ranges.
* **The trap:** LLMs are highly prone to narrating causal links to make summaries sound cohesive (e.g. claiming the pump error caused the turbidity spike).
* **What it measures:** Epistemic discipline. The model must recognize that the events occurred at different times and state that no causal link is supported by the data. The grader explicitly scans for negation phrases (e.g., "no evidence of correlation").

---

## 2. Evaluating the Evaluator: A Hard-Won Lesson

During the development of this framework, we hit a scenario where the agent completed all steps perfectly, but the grader reported a `FAIL` on Step 2.

### **The Bug**
* The csv file header was: `timestamp,turbidity_ntu,chlorine_residual_mgL`
* The model wrote a script that searched for the key `chlorine_residual` (without the unit suffix).
* Because the key was missing in the output schema or was named slightly differently in the script, the grader rejected the run.
* **The Takeaway:** If your evaluation framework is poorly specified or has internal contract bugs (mismatched schema keys between the prompt text, the data files, and the grading code), the AI will fail even when its code is correct. The grader must be verified just as thoroughly as the agent.
