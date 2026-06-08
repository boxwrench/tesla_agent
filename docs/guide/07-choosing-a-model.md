# Chapter 07: Choosing a Model & Benchmark Data

This chapter details the performance benchmarks run on Strix Halo hardware and explains how to select the best model, quantization level, and reasoning configuration.

---

## 0. How This Repo Labels Model Lanes

The public guide is a learning tool, a benchmark-data repository, a
reproducibility reference, and a working water-agent starting point. That means
the model table tracks more than "fastest model wins."

| Lane | Meaning |
|---|---|
| **Default / baseline** | The first setup path most readers should reproduce. |
| **Quality lane** | Slower/deeper model used for synthesis, reports, or second opinions. |
| **Opt-in speed lane** | Verified speed improvement with extra setup or a different artifact. |
| **Experimental** | Interesting benchmark result that is not recommended as a normal route. |
| **Rejected for this workflow** | Fast or popular, but failed this repo's water-agent quality bar. |

If a row is marked opt-in, it is not replacing the default setup. It is a
deliberate choice after the baseline works.

---

## 1. The Quality vs. Speed Trade-Off

When choosing a model, you must balance its logical capability (Quality Score) against how fast it generates text (Generation Speed). 

Below is the benchmark matrix plotted from our testing runs:

![Performance Matrix: Quality vs Speed — Strix Halo (gfx1151). Cyan circles = MoE fast tier; Purple circles = Dense slow tier; Green square = Quality baseline. Gemma 31B appears far left at ~8 tok/s decode.](../assets/quality_vs_speed.png)

### **Key Takeaways from the Benchmarks:**
1. **The QUALITY Champion (StepFun Step-3.7-Flash):** As of the 2026-06-02 stable set, StepFun Step-3.7-Flash (UD-IQ4_XS + MTP Q8_0 draft) graduated as the QUALITY champion for formal synthesis — ~27.9 tok/s decode with a 5/5 coding E2E pass and a 6-0 plain-pairwise record vs gpt-oss-soulfix. It replaced Qwen 3.5 122B at the same decode speed with higher quality.
2. **The AMERICAN-ONLY Tier (gpt-oss-120B, Gemma 4 31B):** Because the champion (StepFun) and the Qwen workhorses are non-US in origin, this tier names the domestic-origin picks for agencies that may require US-only model provenance. **gpt-oss-120B** (OpenAI) is the quality/speed lane (~46 tok/s; 5-1 vs Qwen 35B, 4-2 vs Qwen 122B on blinded six-prompt comparisons), and **Gemma 4 31B** (Google) is the coding second-opinion.
3. **The CODE & PLAN Baselines (Qwen 3.6 35B / Qwen 3.5 35B):** Qwen 3.6 35B is the CODE/general workhorse — fast, compact, repeatedly clearing the tool and coding gates at ~58.5 tok/s on Vulkan/RADV (opt-in MTP lanes raise that to ~72.7 tok/s MXFP4-MTP and ~81.2 tok/s Q4_K_M-MTP). Its sibling **Qwen 3.5 35B-A3B** is the PLAN/AGENTIC baseline (nonce 3/3, ~47.3 tok/s ROCm). Community consensus still favors Qwen reasoning in many settings; this guide keeps both in the ladder for exactly that reason.
4. **The Gemma lanes:** Gemma 4 31B IT Q6_K is the AMERICAN-ONLY coding second-opinion (dense — slow decode), but the official Google Gemma 4 26B-A4B QAT Q4_0 row is the fast Gemma lane: ~59.4 tok/s decode with ~1194 tok/s prefill on Vulkan/RADV. QAT means quantization-aware training, so the model is trained or adapted with the low-precision target in mind; the quality question is whether it holds behavior better than ordinary non-QAT Q4/K-quant controls. The experimental 26B-A4B QAT MTP/Q8 row reaches ~71 tok/s single-stream, but gives up prefill and two-slot throughput and uses a non-QAT-matched assistant head. **Important speed caveat:** Gemma 31B is dense — it reads all 31B parameters every token. Even the QAT Q4_0 31B row is only ~11 tok/s plain and ~15.4 tok/s with experimental MTP, so use 31B for a cross-family second opinion, not as a speed workhorse.
5. **Qwen 122B retired (2026-06-02):** Qwen 122B is no longer in the stack — the StepFun champion covers its formal-synthesis and plan-review role at the same decode speed with higher quality. It stays on disk for regression only.
6. **The 27B Caveat:** Qwen 3.6 27B has a strong reputation as a reasoner, but local Strix Halo tests did not support making it a default route. It lost 0-6 to Qwen 122B in blind pairwise and normal decode stayed around 9.6-11.5 tokens/second across tested backends. It is retained as a break-glass "quiver" option only.

> [!NOTE]
> **Gemma QAT rows are new speed measurements, not a completed quality claim.** The 26B-A4B QAT Q4_0 row is faster than the older UD-Q6_K_XL control, but that does not isolate QAT from the smaller Q4 format. Compare against ordinary non-QAT Q4/K-quants before claiming QAT quality superiority.

> [!NOTE]
> **MTP speed lanes are opt-in.** They require Qwen3.6-35B-A3B-MTP GGUFs, a recent llama.cpp build with `--spec-type draft-mtp` support, and current shaderc / `glslc`. The technique surfaced via the community [strix-halo-guide](https://github.com/hogeheer499-commits/strix-halo-guide); this repo independently reproduced and quality-gated the MXFP4-MTP and Q4_K_M-MTP lanes.

---

## 2. Setting the Thinking Toggle

Newer models feature a "Reasoning/Thinking" mode. When enabled, the model prints its step-by-step thinking process inside a special tag before generating the actual response. This is critical for solving coding and multi-step math problems.

However, decoding these thinking tokens takes time. Depending on your task, you can toggle thinking on or off:

### **Case A: Think-On (Recommended for Coding & Agents)**
* **Use case:** Multi-step tool use, code generation, telemetry QA, log parsing.
* **How to run:** Leave the server settings at default. In Hermes, configure a `max_tokens` headroom of 8192, as the thinking process consumes significant output space.
* **Important:** Gemma 4 31B cleared coding on the orchestrated path. If a single long coding episode degrades, split the job into staged steps rather than treating that as a model failure.

### **Case B: Think-Off (Recommended for Fast Data Extraction & Summaries)**
* **Use case:** Checking a single sensor value, extracting text fields, simple status summaries.
* **How to configure:** On current llama.cpp builds (b9247 and later), use the `--reasoning` flag:
  ```bash
  # Preferred: use --reasoning flag (current llama.cpp b9247+)
  serve_vulkan.sh --reasoning off
  ```
  This disables the reasoning trace at the server level. For Qwen models using the template-kwarg path on older builds, the legacy form was `--jinja --chat-template-kwargs '{"enable_thinking":false}'` — but that syntax is deprecated and prints warnings on current builds. Prefer `--reasoning off`.

  Disabling thinking saves up to 50% wall-clock time for simple extraction tasks while keeping the tool-calling structure fully functional.

> [!WARNING]
> **Do not use `--reasoning-budget 0` to disable thinking.**  
> Setting `--reasoning-budget 0` is broken on llama-server. It will cause the model to print empty responses or fail tool-calling verification. Use `--reasoning off` instead.
>
> **`--chat-template-kwargs '{"enable_thinking":false}'` is deprecated** in current llama.cpp (b9247+). The server may still accept it but will print deprecation warnings, and on some model+template combinations thinking can still initialize incorrectly. Migrate to `--reasoning off` for all models that support it (Qwen 3.6, Gemma 4, gpt-oss-120B on current builds). If you are running an older pinned build and see issues, check the release notes before updating.

### **Case C: Quality Synthesis**
* **Use case:** Formal reports, planning briefs, multi-document synthesis, and board-facing summaries.
* **Recommended lane:** Use the **StepFun Step-3.7-Flash** champion (graduated 2026-06-02) for formal synthesis and plan review.
* **AMERICAN-ONLY lane:** When an agency requires US-origin models, use **gpt-oss-120B** (OpenAI) for quality/speed — with a system prompt that asks the model to draft with clearly labeled assumptions rather than deflecting into a checklist of missing information — and **Gemma 4 31B** (Google) for a coding second opinion.
* *Qwen 3.5 122B, the prior specialist lane, was retired 2026-06-02; StepFun replaced it at the same decode speed with higher quality.*

---

## 3. Quick Decision Guide

If you are unsure which configuration to deploy, check the flowchart below:

* Refer to the visual decision guide: [Model Decision Tree](../reference/decision-tree.md)
* For a detailed summary of terms, refer to the [Terminology Glossary](../reference/glossary.md)
* For exact pins, methodology, pairwise tallies, and retained alternatives, see the [Reproducibility Matrix & Technical Deep-Dive](../reference/reproducibility-matrix.md)
