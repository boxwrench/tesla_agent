# Model Decision Tree

Use this flowchart to select the optimal model, quantization, and reasoning settings on the 128 GB (96 GB GTT) baseline system based on your task priority:

```mermaid
graph TD
    Start["What is the primary task?"]
    
    Start -->|Coding & Multi-Step Logic| Code["Qwen 3.6 35B MoE (Vulkan RADV)<br/>• CODE/general baseline<br/>• think-on, uncapped"]
    style Code fill:#ebf8ff,stroke:#2b6cb0,stroke-width:2px,color:#1a1f36

    Start -->|Cross-family coding check| GemmaCode["Gemma 4 31B IT Q6_K<br/>• CODE Gemma peer<br/>• use orchestrated path"]
    
    Start -->|Formal Report Synthesis| Synth["gpt-oss-120B MXFP4<br/>• QUALITY baseline<br/>• use draft-with-assumptions system prompt"]

    Synth -->|Regulatory currency or sharp plan review| Specialist["Qwen 3.5 122B-A10B MXFP4<br/>• QUALITY spot-specialist<br/>• slower but retained for specific lanes"]
    
    Start -->|Fast QA & Extraction| Ext["Qwen 3.6 35B MoE (MXFP4)<br/>• think-off via chat-template parameter<br/>• Save 50% wall-time"]

    Start -->|GPU pressure or Step-1 file-analysis fallback| Queued["Gemma 4 26B-A4B UD-Q6_K_XL<br/>• coding gate cleared<br/>• queued candidate, not Stable Stack"]
```

---

### Key Takeaway for Strix Halo (APU)
* **Measured local gates now set the ladder.** Qwen remains a strong reasoning family and stays available, but the 2026-05-30 Strix Halo results promote gpt-oss-120B as the general QUALITY baseline and Gemma 4 31B as a cross-family CODE peer.
* **Qwen 122B is no longer the default quality target.** It stays useful as a spot-specialist for regulatory-currency tasks and incisive plan review.
* **Gemma 26B-A4B is queued, not graduated.** It cleared the coding gate and has a narrow file-analysis niche, but Gemma 31B was faster and won the quality pairwise 4-2.
* **Reasoning budgets are a *planning* lever, not a coding one.** Capping `thinking_budget_tokens` cuts wall-clock on prose/planning, but a budget sweep showed *any* cap drops the stateful coding gate to 1–2/3 (only uncapped think-on holds 3/3). Leave the coding route uncapped.
