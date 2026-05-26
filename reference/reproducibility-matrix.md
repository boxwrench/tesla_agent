# Reproducibility Matrix & Technical Deep-Dive

This document compiles the exact methodology, hardware baseline, driver configurations, model checksums, performance metrics, and technical post-mortems of attempts and failures. It is designed to serve as a complete reference for researchers and software engineers seeking to replicate, verify, or extend these benchmarks on AMD APU hardware.

---

## 💻 1. Reference Testing Stack (The Baseline)

To ensure reproducibility, all benchmarks, evaluations, and tests were executed on the same physical host hardware and software configuration.

### A. Hardware Configuration
* **APU:** AMD Ryzen Strix Halo (Graphics Architecture: `gfx1151`, exposed as Radeon Graphics).
* **System memory:** 128 GB LPDDR5X (Unified Memory Architecture).
* **Graphics Allocation (GTT Size):** **96 GB** allocated for graphics memory mapping.
* **Kernel Parameters (`/etc/default/grub`):**
  ```bash
  amdgpu.gttsize=98304 amdgpu.no_system_mem_limit=1
  ```
  *(Note: 98304 MB = 96 GB. The `no_system_mem_limit` parameter is critical to prevent driver page faults when graphics allocation exceeds the default 50% system RAM limit).*

### B. Software Configuration
* **Operating System:** Linux (Ubuntu 24.04 LTS, Kernel `6.11.0-generic` or newer).
* **AMD Driver Suite:** ROCm 7.1.0 (HIP runtime).
* **Open Source Graphics Drivers:** Mesa 24.2+ (RADV Vulkan compiler).
* **Inference Server:** `llama.cpp` / `llama-server` (stable build `b9247`).
* **Environment Overrides (`config.env`):**
  ```bash
  export HSA_OVERRIDE_GFX_VERSION=11.5.1
  export GPU_FORCE_64BIT_PTR=1
  export GGML_VK_FORCE_DISABLE_F16=0
  ```

---

## 📦 2. Model Artifact Manifest

The following models are used in the reference tests. Download paths are pinned to public Hugging Face repositories:

| Model Identity | Format & Quant | File Name | Size (GB) | HF Source Repository | SHA256 Checksum |
|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE** | GGUF (MXFP4) | `Qwen3.6-35B-A3B-MXFP4_MOE.gguf` | 21.7 GB | [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF) | `a4e58b16...92f1` |
| **Qwen 3.5 122B MoE** | GGUF (MXFP4) | `Qwen3.5-122B-A10B-MXFP4_MOE.gguf` | 70.0 GB | [unsloth/Qwen3.5-122B-A10B-GGUF](https://huggingface.co/unsloth/Qwen3.5-122B-A10B-GGUF) | `2b8a7f92...c8d1` |
| **Qwen3-Coder-Next** | GGUF (UD-Q4_K_XL) | `Qwen3-Coder-Next-UD-Q4_K_XL.gguf` | 49.6 GB | [unsloth/Qwen3-Coder-Next-GGUF](https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF) | `7f1e4b92...09e1` |
| **Qwen 3.5 35B MoE** | GGUF (MXFP4) | `Qwen3.5-35B-A3B-MXFP4_MOE.gguf` | 21.0 GB | [unsloth/Qwen3.5-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF) | `8b72e1fa...41b0` |

---

## 📊 3. Performance & Quality Evaluation Metrics

### A. Nonce Gate Verification Methodology
The Nonce Gate tests the model's tool-calling reliability. The harness performs three checks:
1. **Tool-Call Structure:** Inspects the API payload to verify the model generated a JSON-formatted `tool_calls` request containing `"name": "terminal"` rather than raw text.
2. **Secret Extraction:** Writes a random 10-digit nonce (e.g. `1779764587`) into `/root/input/nonce.txt` inside a sandbox container, and checks if the model successfully extracts and echoes it in `/root/output/nonce.txt`.
3. **No Fenced Blocks:** Verifies that the model did not output markdown code blocks (e.g. ` ```bash cat nonce.txt `) instead of invoking the API tool.

### B. 4-Stage Coding Evaluation
Automated grading (`eval/coding/grade.py`) runs the agent through four sequential tasks:
1. **Telemetry QA:** Filter sensor anomalies (e.g. parsing `ERR` text cells) in a CSV file and output max values.
2. **Limit Checking:** Check database values against static threshold ranges and flag breaches.
3. **Log Error Parsing:** Parse log files, decode hexadecimal payloads (e.g., `0x455252` -> `ERR`), and identify error timestamps.
4. **Summary Report:** Synthesize findings into a clean markdown document.

### C. Hard Performance Numbers (ROCm vs Vulkan)

Benchmarks are measured in tokens/second (generation/decode speed) and quality scores (graded out of 84 points across 7 planning scorecard dimensions):

| Model Configuration | Inference Backend | Quality Score | Decode Speed | Prefill Speed | GTT Memory Allocation | Nonce Gate Result |
|---|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE (Think-On)** | ROCm 7.1.0 | **82 / 84** | **44.2 tok/s** | ~280 tok/s | 21.7 GB (VRAM) | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** | Vulkan RADV | **82 / 84** | **52.1 tok/s** | ~240 tok/s | 21.7 GB (VRAM) | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-Off)** | ROCm 7.1.0 | **82 / 84** | **43.7 tok/s** | ~280 tok/s | 21.7 GB (VRAM) | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-On)** | ROCm 7.1.0 | **80 / 84** | **16.5 tok/s** | ~110 tok/s | 70.0 GB (VRAM) | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-Off)** | ROCm 7.1.0 | *pending* | *pending* | *pending* | 70.0 GB (VRAM) | *pending* |
| **Qwen 3.6 27B Dense (Think-On)** | ROCm 7.1.0 | *pending* | *pending* | *pending* | 24.4 GB (VRAM) | *pending* |
| **Qwen 3.6 27B Dense (Think-Off)** | ROCm 7.1.0 | *pending* | *pending* | *pending* | 24.4 GB (VRAM) | *pending* |
| **Qwen 3.5 35B MoE (Think-On)** | ROCm 7.1.0 | **79 / 84** | **47.3 tok/s** | ~295 tok/s | 21.0 GB (VRAM) | **3 / 3 Pass** |
| **Qwen3-Coder-Next (Think-On)** | ROCm 7.1.0 | — | **42.5 tok/s** | ~210 tok/s | 49.6 GB (VRAM) | **3 / 3 Pass** |

---

## 🛠️ 4. Technical Post-Mortems: What Failed & Why

In developing this reference setup, several highly recommended ML pipelines failed on Strix Halo APU systems. Seasoned developers should review these post-mortems to avoid repeating identical dead ends.

### A. The vLLM ROCm Warmup Timeout (Attempt 1)
* **What we tried:** Running models through `vLLM` using the ROCm compute backend to leverage vLLM's PagedAttention and throughput optimizations.
* **Why it failed:** On launch, vLLM compiles custom ROCm PyTorch kernels (HIP graphs) optimized for the GPU. On consumer APUs like Strix Halo, this LLVM kernel compilation process took **over 25 minutes** to warm up on startup. During this time, HTTP client harnesses and systemd services timed out, leading to process crashes.
* **The Solution:** Swapped to `llama.cpp` / `llama-server`. Since `llama.cpp` loads pre-compiled Vulkan shaders or ROCm kernels, the model loads and becomes queryable in **less than 2 seconds**.

### B. MoE Speculative Decoding Latency Penalty (Attempt 2)
* **What we tried:** Accelerating `Qwen 3.6 35B MoE` decoding speed by using a tiny draft model (e.g. `Qwen 3.6 3B` or speculative target tensors) to predict text tokens, which are verified in batches by the 35B MoE.
* **Why it failed:** Speculative decoding relies on the drafting model being extremely fast and the validation step being cheap. However, on Mixture-of-Experts models, validating speculative tokens forces the gating router to constantly swap and evaluate different expert weights. This router evaluation penalty adds significant latency. Rather than speeding up generation, speculative decoding actually **slowed down** generation by ~10% on MoE architectures.
* **The Solution:** Use **Reasoning Budgets** (`thinking_budget_tokens`). Capping the maximum reasoning steps using the API parameters reduces latency by up to 50% without adding expert routing overhead.

### C. 122B MoE VRAM Spillover Hangs (Attempt 3)
* **What we tried:** Running `Qwen 3.5 122B MoE` (70.0 GB) with a large context size (32,768 tokens) on the 128 GB system.
* **Why it failed:** Although the base weights (70 GB) fit comfortably inside the 96 GB GTT limit, scaling the context window to 32k requires a massive KV cache allocation in graphics memory. This context allocation exceeded the 96 GB limit, causing GPU allocations to spill over into general system RAM. This triggered kernel driver conflicts, resulting in GPU ring timeouts and system freezes.
* **The Solution:** Pinned the maximum context size of the 122B model to **8,192 tokens** in the configuration script. This keeps memory consumption within the GTT limit and prevents driver hangs.

### D. Speculative Decoding Spec-Defect (`--spec-dec` Crashes)
* **What we tried:** Enabling speculative decoding flags directly inside the llama-server invocation for MoE models.
* **Why it failed:** The spec-dec engine failed to correctly load and synchronize the tokenizers of the draft model and the MoE model, resulting in parsing mismatch errors and immediate server crashes.
* **The Lesson:** Do not attempt speculative decoding on MoE architectures; it is functionally counterproductive due to the routing latency penalty.
