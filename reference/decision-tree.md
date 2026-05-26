# Model Decision Tree

Use this flowchart to select the optimal model, quantization, and reasoning settings on the 128 GB (96 GB GTT) baseline system based on your task priority:

```mermaid
graph TD
    Start["What is the primary task?"]
    
    Start -->|Coding & Multi-Step Logic| Code["Qwen 3.6 35B MoE (MXFP4)<br/>• thinking_budget_tokens: 512<br/>• max_tokens: 8192"]
    style Code fill:#ebf8ff,stroke:#2b6cb0,stroke-width:2px,color:#1a1f36
    
    Start -->|Formal Report Synthesis| Synth["Qwen 3.5 122B MoE (MXFP4)<br/>• Context limit: 8192 (VRAM safety)<br/>• thinking_budget_tokens: 1024"]
    
    Start -->|Fast QA & Extraction| Ext["Qwen 3.6 35B MoE (MXFP4)<br/>• think-off via chat-template parameter<br/>• Save 50% wall-time"]
```

---

### Key Takeaway for Strix Halo (APU)
* **MoE Models** (35B and 122B) run incredibly fast and behave intelligently but consume significant memory mapping tables. They are fully supported and recommended on the 128 GB system memory baseline.

