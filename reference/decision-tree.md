# Model Decision Tree

Use this flowchart to select the optimal model, quantization, and reasoning settings on the 128 GB (96 GB GTT) baseline system based on your task priority:

The tree is a routing aid, not a universal leaderboard. It reflects this repo's
measured local gates for a water/utility agent workflow: tool discipline,
coding reliability, report quality, speed, and reproducibility.

```mermaid
graph TD
    Start["What is the primary task?"]
    
    Start -->|Coding & Multi-Step Logic| Code["Qwen 3.6 35B MoE (Vulkan RADV)<br/>• CODE/general workhorse (~58.5 tok/s)<br/>• think-on, uncapped"]
    style Code fill:#ebf8ff,stroke:#2b6cb0,stroke-width:2px,color:#1a1f36

    Code -->|Opt-in speed lane| MTP["Qwen3.6-35B-A3B-MTP<br/>• MXFP4-MTP ~72.7 tok/s<br/>• Q4_K_M-MTP ~81.2 tok/s<br/>• requires --spec-type draft-mtp"]
    style MTP fill:#ecfeff,stroke:#0f766e,stroke-width:2px,color:#1a1f36

    Start -->|Planning & Agentic Loops| Plan["Qwen 3.5 35B-A3B MoE (MXFP4)<br/>• PLAN/AGENTIC baseline<br/>• proven nonce 3/3"]
    style Plan fill:#eef2ff,stroke:#4338ca,stroke-width:2px,color:#1a1f36

    Start -->|Formal Report Synthesis| Synth["StepFun Step-3.7-Flash UD-IQ4_XS + MTP Q8_0 draft<br/>• QUALITY champion (graduated 2026-06-02)<br/>• ~27.9 tok/s; coding 5/5 E2E"]
    style Synth fill:#f0fff4,stroke:#2f855a,stroke-width:2px,color:#1a1f36

    Start -->|Agency requires US-origin models only| American["AMERICAN-ONLY tier<br/>• gpt-oss-120B MXFP4 — quality/speed (~46 tok/s)<br/>• Gemma 4 31B IT Q6_K — coding second-opinion (dense, ~8 tok/s)"]
    style American fill:#fffaf0,stroke:#c05621,stroke-width:2px,color:#1a1f36

    Start -->|Fast QA & Extraction| Ext["Qwen 3.6 35B MoE (MXFP4)<br/>• --reasoning off<br/>• Save 50% wall-time"]

    Start -->|GPU pressure or Step-1 file-analysis fallback| GemmaControl["Gemma 4 26B-A4B UD-Q6_K_XL<br/>• verified plain-control baseline<br/>• think-off, F16 KV, 3/3 nonce"]
```

---

### Key Takeaway for Strix Halo (APU)
* **Measured local gates set the ladder.** Qwen 3.6 35B is the CODE/general workhorse and Qwen 3.5 35B is the PLAN/AGENTIC baseline. As of the 2026-06-02 stable set, **StepFun Step-3.7-Flash graduated as the QUALITY champion** for formal synthesis (it replaced Qwen 122B at the same decode speed with higher quality).
* **The AMERICAN-ONLY tier is for agencies that may require US-origin models.** Because the champion (StepFun) and the Qwen workhorses are non-US in origin, this tier names the domestic-origin picks: **gpt-oss-120B** (OpenAI) for quality/speed and **Gemma 4 31B** (Google) as the coding second-opinion (dense — ~8 tok/s decode; use on the orchestrated path, not as a throughput pick).
* **Qwen 3.5 122B is retired** (2026-06-02). StepFun covers the quality role it used to hold.
* **MTP speed lanes are opt-in.** Qwen3.6-35B-A3B-MTP keeps the Qwen workhorse role but requires the MTP GGUFs, a recent llama.cpp build, and current shaderc / `glslc`.
* **Gemma 26B-A4B is a verified plain-control baseline, not a queued candidate.** It keeps a narrow file-analysis / memory-pressure niche, measured and reproducible at ~44.8 tok/s tg128 with F16 KV and reasoning off.
* **Reasoning budgets are a *planning* lever, not a coding one.** Capping `thinking_budget_tokens` cuts wall-clock on prose/planning, but a budget sweep showed *any* cap drops the stateful coding gate to 1–2/3 (only uncapped think-on holds 3/3). Leave the coding route uncapped.
