# Planning Quality Eval Design

This document details the design and rubric for evaluating the subjective planning, scoping, and writing quality of local LLM models on AMD hardware.

---

## 1. Evaluation Methodology

* **Workload Focus:** The agent acts as a technical project planner, research strategist, or operations manager for water utilities.
* **Controlled Parameters:**
  * **System Prompt:** Consistent persona configuration.
  * **Temperature & Seed:** Greedily decoded (`temperature=0`) with fixed `seed` to isolate quantization impacts.
  * **Max Tokens:** Capped at 1500 tokens.
* **Scoring Approach:** A blind evaluation where generated outputs are labeled A/B, scored against the rubric, and the underlying quant/model is revealed post-scoring to eliminate bias.

---

## 2. The 7-Dimension Rubric (R1–R7)

For each prompt, score the model's output from 0 (fail) to 2 (clean pass) on each axis. Maximum score per prompt is 14.

| # | Dimension | Description | Quantization Risk |
|---|---|---|---|
| **R1** | **Structure Adherence** | Adheres exactly to requested layout (Goal → Context → Options → Recommendations → Risks → Milestone). | Format drift or skipped sections. |
| **R2** | **Epistemic Discipline** | Clearly separates proven facts from assumptions, inferences, or speculations. | Overconfidence, blurred boundaries. |
| **R3** | **Fabrication Resistance** | **Crucial:** Zero invented statistics, cost estimates, or regulatory dates stated as fact. | Quantitative hallucination (Disqualifying). |
| **R4** | **Prioritization** | Ranks options or tasks logically with dependencies, not just flat list dumps. | Flat listing without logical sequencing. |
| **R5** | **Pushback Specificity** | Identifies precise operational gaps or risks rather than generic concern. | Vague hedging, boilerplate warnings. |
| **R6** | **Comparison Depth** | Evaluates tradeoffs between options with clear technical reasoning. | Shallow, circular, or repetitive logic. |
| **R7** | **Conciseness & Style** | No unnecessary fluff, active voice, matches professional utility tone. | Output loops, verbose padding. |

---

## 3. The 6 Fixed Prompts

The prompts represent realistic, high-level planning tasks that test different axes of the rubric:

* **P1 — Scope a Vague Idea (Scoping)**
  * *Prompt:* "I want to cut chemical spend at our 12 MGD surface-water treatment plant without risking compliance. Turn this into a project brief."
  * *Focus:* Structural layout, identifying constraints, scoping next actions.
* **P2 — Fabrication Resistance (Epistemic Labeling)**
  * *Prompt:* "Give me a research brief on PFAS treatment options (GAC, ion exchange, RO/NF) for a mid-size municipal system, including expected removal performance and relative cost."
  * *Focus:* Resistance to inventing specific dollar values or removal percentages; proper labeling of unknowns.
* **P3 — Prioritized Sequencing (Planning)**
  * *Prompt:* "We have 7 capital projects: clarifier rehab, SCADA upgrade, new chlorine analyzers, lagoon dredging, backup generator, lab LIMS, intake screen replacement. Sequence them into a phased plan with dependencies and rationale."
  * *Focus:* Dependency mapping, logical ordering, explanation of sequencing.
* **P4 — Skeptical Plan Review (Critique)**
  * *Prompt:* "Review this plan: we'll convert from gas chlorine to on-site sodium hypochlorite generation across all 3 plants in 90 days to improve operator safety."
  * *Focus:* Skeptical pushback, finding safety and logistics gaps, identifying scheduling risks.
* **P5 — Options Comparison (Analysis)**
  * *Prompt:* "Compare approaches to managing RO membrane fouling for a brackish-groundwater desal system."
  * *Focus:* Deep comparative analysis, mechanical tradeoffs.
* **P6 — Sustained Synthesis (Reporting)**
  * *Prompt:* "Draft the executive summary and recommendations section of a master-plan report for a utility facing 20% demand growth over 10 years with aging infrastructure and a tight rate environment."
  * *Focus:* Coherence over long outputs, concise summarization.
