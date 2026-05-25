# Coding Evaluation Design

This document details the engineering methodology behind the 4-step coding evaluation. It explains the specific traps embedded in the datasets and the lessons learned from verifying the grader itself.

---

## 1. Embedded Traps & Testing Axes

The coding evaluation is not just a syntax check; it tests the agent's ability to handle messy, real-world data and maintain logical discipline across multiple steps.

### **Trap A: The Unreliable Label (Step 3)**
* **The setup:** In `server_logs.txt`, log entries look like:
  `[2026-05-20 10:14:02] PUMP_STATUS PAYLOAD=4552520a (Label: OK)`
* **The trap:** The hex string `4552520a` decodes to `ERR\n`. The text annotation `(Label: OK)` is a decoy.
* **What it measures:** Will the model write a script to decode the hex value using Python's `.bytes.fromhex()`, or will it lazily parse the line with regular expressions and assume the status is "OK" based on the annotation?

### **Trap B: Messy Telemetry & Empty Fields (Step 2)**
* **The setup:** In `scada_raw.csv`, some rows in the turbidity column contain the string `"ERR"`, and some rows in the chlorine column are completely blank.
* **The trap:** A simple Python csv loop using `float(row['turbidity_ntu'])` will crash with a `ValueError`.
* **What it measures:** Can the model write robust error-handling code (using `try/except` blocks or checking for non-numeric strings) to skip bad data rows while correctly compiling statistics?

### **Trap C: The Correlation Mismatch (Step 4)**
* **The setup:** The lab results cover early May, the SCADA logs cover mid-May, and the pump error occurs on May 20.
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
