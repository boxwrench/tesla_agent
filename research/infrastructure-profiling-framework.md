# The Split-Route Agentic Framework: Autonomous Infrastructure Profiling

This document outlines a generalized, hardware-aware agentic workflow designed to extract structured engineering data from massive, unstructured documents (e.g., blueprints, O&M manuals, system architectures) and synthesize it into actionable intelligence.

While originally developed for Water Treatment Facility profiling, the shape of the problem—and the solution—is domain-agnostic. It applies equally to data centers, manufacturing plants, power grids, or HVAC systems.

## The Core Problem
Engineering documents are dense, noisy, and highly technical. 
1.  **Context Overload:** Dropping a 200-page manual into an LLM context window risks the "Lost in the Middle" phenomenon, where critical numbers are ignored.
2.  **The "Reasoning vs. Extraction" Conflict:** If you ask an LLM to "extract the data and tell me what it means" in one prompt, you force it to mix rigid data extraction with fluid reasoning. This often results in hallucinations (invented numbers) or failed structural formatting.

## The "Split-Route" Methodology
To solve this, the pipeline strictly separates the workflow into two distinct phases, utilizing different model scales and cognitive modes based on the specific constraints of the hardware (e.g., bandwidth limits on local APUs/GPUs).

### Phase A: The Semantic Extractor (The Rigid Route)
**Goal:** Convert noisy, unstructured text into an **Opinionated Schema**.
*   **The Model:** A heavyweight, high-parameter model (e.g., 120B+ class).
*   **The Mode:** **"Think-Off"** (No reasoning prose, direct output).
*   **The Input:** Chunked document text (pre-processed via OCR/Layout parsers like Marker/Docling) + an Opinionated JSON Schema.
*   **The Output:** A mathematically strict, normalized JSON object.

**Why it works:** Heavyweight models possess the semantic depth to understand complex engineering jargon (e.g., distinguishing "Peak Load" from "Nameplate Capacity"). By forcing the model into "Think-Off" mode and binding it to a strict schema containing explicit units and enums, we eliminate hallucinations. Furthermore, this highly predictable output structure maximizes the efficiency of speculative decoding (suffix-matching) on bandwidth-constrained hardware.

#### Anatomy of an Opinionated Schema
Regardless of the domain, the extraction schema must follow these rules:
1.  **Explicit Units in Keys:** (e.g., `design_flow_mgd` or `cooling_capacity_kw`). This forces the model to normalize units during extraction.
2.  **Strict Enums:** (e.g., `status: [Active, Standby, Decommissioned, Unknown]`). Prevents narrative answers.
3.  **The Null Escape Hatch:** All fields must allow `null`. The model must have permission to report that data is missing rather than inventing an industry-standard average.

### Phase B: The Synthesis Engineer (The Fluid Route)
**Goal:** Apply domain logic to the normalized data to produce actionable briefs or design recommendations.
*   **The Model:** A mid-weight, high-speed model (e.g., 30B–70B class).
*   **The Mode:** **"Think-On"** (Chain-of-thought reasoning required).
*   **The Input:** The clean JSON profile from Phase A + a specific engineering prompt (e.g., "Calculate the system bottleneck").
*   **The Output:** An executive brief, calculation report, or design proposal.

**Why it works:** Because Phase A has already cleansed and structured the data, the mid-weight model does not need to search for facts. It can dedicate its entire context window and compute cycle to *reasoning*. This route relies on the model's ability to generate high-entropy prose, leveraging fast local generation speeds to rapidly iterate through engineering tradeoffs.

## The Handoff (Example Application)

**1. The Scenario:** Profiling a Data Center HVAC system.
**2. Phase A (Extractor):** Reads the PDF schematics. Outputs a JSON profile detailing the number of chillers, the `flow_rate_gpm` of the chilled water loop, and the `design_delta_t_fahrenheit`.
**3. Phase B (Synthesizer):** Receives the JSON. Prompted with: *"Given this cooling profile and a planned addition of 500kW of server load, use your reasoning block to determine if the chilled water loop requires a new pump or just an adjustment to the Delta T."*

By splitting the pipeline, we achieve deterministic data extraction and high-quality engineering synthesis, running entirely autonomously on local hardware.