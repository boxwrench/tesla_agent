# Chapter 07: Choosing a Model & Benchmark Data

This chapter details the performance benchmarks run on Strix Halo hardware and explains how to select the best model, quantization level, and reasoning configuration.

---

## 1. The Quality vs. Speed Trade-Off

When choosing a model, you must balance its logical capability (Quality Score) against how fast it generates text (Generation Speed). 

Below is the benchmark matrix plotted from our testing runs:

![Quality vs Speed Comparison](../assets/quality_vs_speed.png)

### **Key Takeaways from the Benchmarks:**
1. **The MoE Workhorse (Qwen 3.6 35B):** Achieves a high quality score (82/84) while maintaining a fast speed of ~44 tokens/second. This is the optimal default model for local agent workflows.
2. **The Quality Escalation (Qwen 3.5 122B):** Delivers the highest quality score (84/84) for complex, high-stakes report writing, but runs slower (~16 tokens/second) and requires 70 GB of VRAM pool.
3. **The Dense Competitors:** Are generally outperformed by the Mixture-of-Experts (MoE) models at equivalent sizes, as MoE layers route calculations dynamically, keeping token generation speeds high.

---

## 2. Setting the Thinking Toggle

Newer models feature a "Reasoning/Thinking" mode. When enabled, the model prints its step-by-step thinking process inside a special tag before generating the actual response. This is critical for solving coding and multi-step math problems.

However, decoding these thinking tokens takes time. Depending on your task, you can toggle thinking on or off:

### **Case A: Think-On (Recommended for Coding & Agents)**
* **Use case:** Multi-step tool use, code generation, telemetry QA, log parsing.
* **How to run:** Leave the server settings at default. In Hermes, configure a `max_tokens` headroom of 8192, as the thinking process consumes significant output space.

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

---

## 3. Quick Decision Guide

If you are unsure which configuration to deploy, check the flowchart below:

* Refer to the visual decision guide: [Model Decision Tree](../reference/decision-tree.md)
* For a detailed summary of terms, refer to the [Terminology Glossary](../reference/glossary.md)
