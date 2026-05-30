# Chapter 07: Choosing a Model & Benchmark Data

This chapter details the performance benchmarks run on Strix Halo hardware and explains how to select the best model, quantization level, and reasoning configuration.

---

## 1. The Quality vs. Speed Trade-Off

When choosing a model, you must balance its logical capability (Quality Score) against how fast it generates text (Generation Speed). 

Below is the benchmark matrix plotted from our testing runs:

![Quality vs Speed Comparison](../assets/quality_vs_speed.png)

### **Key Takeaways from the Benchmarks:**
1. **The QUALITY Baseline (gpt-oss-120B):** The latest local pairwise tests moved gpt-oss-120B into the general quality tier. It beat Qwen 35B by 5-1 and Qwen 122B by 4-2 on blinded six-prompt comparisons, while decoding at ~46 tokens/second on Vulkan/RADV.
2. **The CODE Baseline (Qwen 3.6 35B):** Qwen 3.6 35B remains the CODE/general baseline because it is fast, compact, and has repeatedly cleared the tool and coding gates. Community consensus still favors Qwen reasoning in many settings; this guide keeps it in the ladder for exactly that reason.
3. **The Gemma Peer (Gemma 4 31B):** Gemma 4 31B IT Q6_K is the cross-family coding peer. It cleared nonce and orchestrated coding gates, runs at 43-48 tokens/second, and beat the smaller Gemma 26B-A4B candidate 4-2 in quality pairwise.
4. **The Qwen 122B Role Change:** Qwen 122B is no longer the default quality target. It remains a spot-specialist for regulatory-currency work and sharp plan review, where it retained its pairwise wins.
5. **The 27B Caveat:** Qwen 3.6 27B has a strong reputation as a reasoner, but local Strix Halo tests did not support making it a default route. It lost 0-6 to Qwen 122B in blind pairwise and normal decode stayed around 9.6-11.5 tokens/second across tested backends.

---

## 2. Setting the Thinking Toggle

Newer models feature a "Reasoning/Thinking" mode. When enabled, the model prints its step-by-step thinking process inside a special tag before generating the actual response. This is critical for solving coding and multi-step math problems.

However, decoding these thinking tokens takes time. Depending on your task, you can toggle thinking on or off:

### **Case A: Think-On (Recommended for Coding & Agents)**
* **Use case:** Multi-step tool use, code generation, telemetry QA, log parsing.
* **How to run:** Leave the server settings at default. In Hermes, configure a `max_tokens` headroom of 8192, as the thinking process consumes significant output space.
* **Important:** Gemma 4 31B cleared coding on the orchestrated path. If a single long coding episode degrades, split the job into staged steps rather than treating that as a model failure.

### **Case B: Think-Off (Recommended for fast Data Extraction & Summaries)**
* **Use case:** Checking a single sensor value, extracting text fields, simple status summaries.
* **How to configure:** You must disable thinking by configuring llama-server's template parameters:
  ```bash
  # Launch server with thinking disabled in the chat template
  serve_rocm.sh --jinja --chat-template-kwargs '{"enable_thinking":false}'
  ```
  This empties the reasoning process from the response stream, saving up to 50% wall-clock time, while keeping the tool-calling structure fully functional.

> [!WARNING]
> **Do not use `--reasoning-budget 0` to disable thinking.**  
> Setting `--reasoning-budget 0` is broken on llama-server. It will confuse the model, causing it to print empty responses or fail tool-calling verification. You must use the `'{"enable_thinking":false}'` chat template parameter instead.

### **Case C: Quality Synthesis**
* **Use case:** Formal reports, planning briefs, multi-document synthesis, and board-facing summaries.
* **Recommended lane:** Use gpt-oss-120B as the general quality baseline, with a system prompt that asks the model to draft with clearly labeled assumptions rather than deflecting into a checklist of missing information.
* **Specialist lane:** Use Qwen 122B when the task depends on regulatory currency or an incisive plan-review voice.

---

## 3. Quick Decision Guide

If you are unsure which configuration to deploy, check the flowchart below:

* Refer to the visual decision guide: [Model Decision Tree](../reference/decision-tree.md)
* For a detailed summary of terms, refer to the [Terminology Glossary](../reference/glossary.md)
* For exact pins, methodology, pairwise tallies, and retained alternatives, see the [Reproducibility Matrix & Technical Deep-Dive](../reference/reproducibility-matrix.md)
