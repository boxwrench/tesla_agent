# Quality Evaluation Scorecard Template

Use this scorecard to evaluate and compare the planning and report synthesis quality of different local models or quantization levels.

**Model Under Test:** [Name & Quantization]  
**Backend & Engine:** [e.g. llama.cpp ROCm, Vulkan]  
**Parameters:** Temperature=0, Seed=42, Context=16k

---

## Score Summary Table

| Dimension | P1 (Scope) | P2 (PFAS) | P3 (Seq) | P4 (Review) | P5 (RO) | P6 (Summary) | Total |
|---|---|---|---|---|---|---|---|
| **R1: Structure** | | | | | | | **/ 12** |
| **R2: Epistemic** | | | | | | | **/ 12** |
| **R3: Fabrication** | | | | | | | **/ 12** |
| **R4: Prioritization** | | | | | | | **/ 12** |
| **R5: Pushback** | | | | | | | **/ 12** |
| **R6: Tradeoffs** | | | | | | | **/ 12** |
| **R7: Style/Concise** | | | | | | | **/ 12** |
| **Total Score** | **/14** | **/14** | **/14** | **/14** | **/14** | **/14** | ** / 84** |

---

## Scoring Rubric Guide

For each box, score **0 (fail)**, **1 (partial)**, or **2 (clean pass)**:
* **0 (Fail):** The model fails the criteria completely (e.g. fabricates costs in P2, dumps a flat list without dependencies in P3).
* **1 (Partial):** The model attempts the criteria but has minor lapses (e.g. lists some dependencies but skips others, output drifts slightly from the standard layout).
* **2 (Pass):** Clean, rigorous execution matching the standard layout, zero fabrication, clear epistemic boundaries.

---

## Detailed Evaluation Notes

### **P1 — Scope a Vague Idea**
* **Score:** / 14
* **Notes:**
  * Format drift:
  * Milestone quality:
  * Constraints identified:

### **P2 — PFAS Treatment options**
* **Score:** / 14
* **Notes:**
  * Invented figures/percentages? (R3):
  * Cost scaling rationale:
  * Epistemic check (evidence vs guess):

### **P3 — Prioritized Sequencing**
* **Score:** / 14
* **Notes:**
  * All 7 projects included?:
  * Dependency logic:
  * Flowchart clear?:

### **P4 — Skeptical Plan Review**
* **Score:** / 14
* **Notes:**
  * Concrete safety/regulatory pushback:
  * Alternative recommendations:
  * Logistics critique:

### **P5 — RO Membrane Fouling**
* **Score:** / 14
* **Notes:**
  * Technical depth of trade-offs:
  * Clear comparison structure:

### **P6 — Executive Summary Synthesis**
* **Score:** / 14
* **Notes:**
  * Formatting compliance:
  * Concise framing:
  * Coherence over long generation:

---

## Decision Verdict
* **Total Score:** / 84
* **Fabrication Check (R3 clean?):** [Yes / No - details if failed]
* **Latency & Speed:** [t/s and mean response time]
* **Recommendation:** [Promote to baseline / Retain existing baseline / Reject]
