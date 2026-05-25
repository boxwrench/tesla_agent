# Model Decision Tree

Use this flowchart to select the optimal model, quantization, and reasoning settings based on your system RAM size and task priority:

```mermaid
graph TD
    Start["Determine System RAM"] --> RAM128["128 GB System RAM (96GB GTT)"]
    Start --> RAM64["64 GB System RAM (48GB GTT)"]
    
    %% 128 GB Branch
    RAM128 --> Goal128["What is the primary task?"]
    
    Goal128 -->|Coding & Multi-Step Logic| Code128["Qwen 3.6 35B MoE (MXFP4)<br/>• thinking_budget_tokens: 512<br/>• max_tokens: 8192"]
    style Code128 fill:#0f2027,stroke:#06b6d4,stroke-width:2px,color:#fff
    
    Goal128 -->|Formal Report Synthesis| Synth128["Qwen 3.5 122B MoE (MXFP4)<br/>• Context limit: 8192 (vram safety)<br/>• thinking_budget_tokens: 1024"]
    
    Goal128 -->|Fast QA & Extraction| Ext128["Qwen 3.6 35B MoE (MXFP4)<br/>• think-off via chat-template template<br/>• Save 50% wall-time"]
    
    %% 64 GB Branch
    RAM64 --> Goal64["What is the primary task?"]
    
    Goal64 -->|Coding & Multi-Step Logic| Code64["Qwen3.6-27B (Q6_K, dense) — projected<br/>• Coder-Next (UD-Q4_K_XL) is ~49.6GB → 128GB-class, won't fit 64GB<br/>• Not yet benchmarked on this hardware"]
    
    Goal64 -->|Formal Report Synthesis| Synth64["Qwen3.6-27B (Q6_K, dense) — projected<br/>• Higher semantic quality<br/>• Not yet benchmarked"]
    
    Goal64 -->|Fast QA & Extraction| Ext64["Qwen3.6-7B (Q6_K) — projected<br/>• Extremely fast decode<br/>• Not yet benchmarked"]
```

---

### Key Takeaway for Strix Halo (APU)
* **MoE Models** (35B and 122B) run incredibly fast and behave intelligently but consume significant memory mapping tables. They should **only** be run on 128 GB systems.
* **Dense Models** (7B and 27B) should be used on 64 GB setups to preserve context memory buffers and prevent graphics crashes.
