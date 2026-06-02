# Research

Long-form deep-research artifacts that informed the recommendations elsewhere in this repo. Each piece below was commissioned or authored to investigate a specific question about local agentic workflows on AMD Strix Halo (gfx1151) — backend tradeoffs, quantization choices, tool-calling discipline, hardware/driver interactions, and prompt-architecture patterns for water-utility and technical R&D workflows.

These are the source-of-record documents. The Model Finder, decision tree, and reproducibility matrix in this repo distill the conclusions; the files here preserve the full reasoning, citations, and counter-arguments behind each conclusion.

## Strategic deep dives

### [Strategic Architecture for Frontier MoE Integration on AMD Strix Halo (gfx1151)](./strategic-architecture-frontier-moe-strix-halo.md)
*Mitigating kernel failures, speculative decoding trade-offs, and agentic tool normalization.* 58 KB. The flagship piece. An architectural blueprint for deploying frontier Mixture-of-Experts models on 128 GB unified memory with a 96 GiB GTT cap — covers ROCm kernel deficits, why the older separate-draft MoE speculative path failed while dense speculative decoding succeeded, and how to keep tool-calling discipline under the Hermes orchestration framework. For the newer Qwen MTP result, see the MTP case study below.

### [The Cognitive Dual-Stack: Engineering High-Performance Local Workflows](./cognitive-dual-stack-engineering-local-workflows.md)
*From strategic prompt architectures to hardware-compiled runtimes.* 64 KB. The most general piece. Argues that local frontier-model deployment is a dual-stack problem: cognitive prompt architectures on top, hardware-specific compilation layers underneath, and neither stack can be optimized in isolation. Frames the engineering decisions readers face as a single system rather than a list of independent choices.

### [High-Performance Orchestration of Reasoning-Enabled Architectures on AMD Unified Memory Platforms](./high-performance-orchestration-reasoning-architectures.md)
*A definitive engineering blueprint for local deployment of hybrid-thinking and sparse-MoE models.* 51 KB. The backend-deep piece. Evaluates llama.cpp serving capabilities at build `b9247`, tool-calling grammar constraints, custom quantization strategies (MXFP4, UD-Q6_K_XL, Q8_0), and driver-level compiler dynamics on gfx1151.

## Project-specific syntheses

### [American Stack Research — Synthesis (Round 1)](./american-stack-research-synthesis.md)
*The first-pass synthesis of backend, quantization, and tool-calling research for the American-Stack project.* 19 KB. Sources reviewed, claims weighed, and decisions framed for round-2 verification.

### [American Stack Research — Synthesis (Round 2, Targeted Verification)](./american-stack-research-synthesis-round2.md)
*Targeted verification that resolved the open questions from round 1.* 13 KB. Reads on top of round 1; closes the loop on the claims that survived first-pass scrutiny.

## Methodology and framework

### [MTP Self-Speculative Decoding on Strix Halo](./mtp-speculative-decoding-strix-halo.md)
*Case study dated June 2026.* A concise methodology note on vetting a community speedup claim: reproduce the MTP pipeline from the strix-halo-guide, gate the quants on nonce/coding/quality, reject the speed-first IQ4_XS lane for this repo's quality bar, and ship the quality-preserving MXFP4-MTP and Q4_K_M-MTP options.

### [Comprehensive Agentic LLM Evaluation on AMD Strix Halo (128 GB)](./strix-halo-agentic-evaluation-report.md)
*Evaluation report dated May 24, 2026.* 7 KB. The methodology piece — what was measured, how, and why each metric matters for local agentic workflows. Companion to the reproducibility matrix.

### [The Split-Route Agentic Framework: Autonomous Infrastructure Profiling](./infrastructure-profiling-framework.md)
*A generalized, hardware-aware agentic workflow for extracting structured engineering data from massive unstructured documents.* 4 KB. The framework piece — designed for blueprints, O&M manuals, system architectures. Direct relevance to water-utility and technical R&D work: turning a stack of scanned regulatory documents or plant drawings into actionable intelligence.

---

## Reading order suggestions

- **Just want the bottom line on what to run?** Skip this folder; use the [Model Finder](../docs/index.html) and [reproducibility matrix](../reference/reproducibility-matrix.md).
- **Want to understand *why* the recommendations are what they are?** Start with [Strategic Architecture for Frontier MoE Integration](./strategic-architecture-frontier-moe-strix-halo.md).
- **Building or evaluating a similar local stack?** [The Cognitive Dual-Stack](./cognitive-dual-stack-engineering-local-workflows.md) → [High-Performance Orchestration](./high-performance-orchestration-reasoning-architectures.md) → the two American-Stack syntheses, in that order.
- **Working on document-extraction or P&ID / O&M workflows?** [The Split-Route Agentic Framework](./infrastructure-profiling-framework.md).
