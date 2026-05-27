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
* **AMD Driver Suite:** ROCm 7.2.x (HIP runtime; 7.1.x also works).
* **Open Source Graphics Drivers:** Mesa 25.2.8 (RADV Vulkan compiler).
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
| **Qwen 3.6 35B MoE (Think-On)** — **default** | **Vulkan RADV** | **82 / 84** | **50.1 tok/s** | **932.1 tok/s** | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** — fallback | ROCm 7.2.x | **82 / 84** | **44.2 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-Off)** | ROCm 7.2.x | **82 / 84** | **43.7 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-On)** | ROCm 7.2.x | **80 / 84** | **19.4 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-Off)** | ROCm 7.2.x | **81 / 84** | **19.5 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Qwen 3.6 27B Dense (Think-On)** *(experimental, not in stack)* | ROCm 7.2.x (UD-Q4_K_XL) | — | **~7.0 tok/s** | — | 16.4 GB | **3 / 3 Pass** (coding 3/3) |
| **Qwen 3.6 27B Dense (Think-Off)** *(experimental, not in stack)* | ROCm 7.2.x (UD-Q4_K_XL) | — | **~7.0 tok/s** | — | 16.4 GB | **3 / 3 Pass** (coding 1/3) |
| **Qwen 3.6 27B Dense + DFlash spec.** *(experimental)* | Lucebox HIP (Q4_K_M draft) | — | **~31.3 tok/s (2.82×)** | — | ~16 GB | discipline-limited |
| **Qwen 3.5 35B MoE (Think-On)** | ROCm 7.2.x | **79 / 84** | **47.3 tok/s** | ~562.9 tok/s | 21.0 GB | **3 / 3 Pass** |
| **Qwen3-Coder-Next (Think-On)** | ROCm 7.2.x | — | **34.6 tok/s** | ~127.0 tok/s | 49.6 GB | **3 / 3 Pass** |

> **Status: the dense 27B is benchmarked but NOT in the production stack.** A blind
> quality pairwise put it 0–6 vs the 122B (largely output-discipline leakage, but it
> showed no reasoning *upgrade* over the 35B/122B on substance), and it is slower than
> the 35B workhorse. It is retained as a break-glass *"arrow in the quiver"* for tough,
> blocked projects — not a first- or second-line model. The speculative-decoding result
> below is kept as a technical finding.
>
> **DFlash speculative decoding on the dense 27B** lifts its ~7 tok/s autoregressive floor to **~31.3 tok/s (2.82×)** using a footprint-minimized Q4_K_M draft (HumanEval 2.57×, mean acceptance length 6.67, DDTree budget 22 — the gfx1151 sweet spot). Counter-intuitively the *smaller* Q4_K_M draft (1.03 GB) beats a larger Q8_0 draft (1.84 GB, only 1.49×): on this bandwidth-bound APU the draft's own weight reads compete for the same memory bus the target needs to verify, so minimizing draft footprint wins. This is the inverse of the MoE speculative-decoding result (post-mortem #3) — speculation succeeds on **dense** models because there is no expert router to thrash. *Speed is verified; pairing this speed with full tool-call discipline on the same Q4_K_M build is still in validation (the verified 27B tool-call/coding passes above are on the UD-Q4_K_XL build).*

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
* **The Latency Lever (with a caveat):** Use **Reasoning Budgets** (`thinking_budget_tokens`) to cap how many tokens the model spends "thinking." On **planning / prose** workloads this cuts wall-clock substantially without expert-routing overhead. **But do NOT cap the CODE route:** a controlled budget sweep found that *no* bounded budget reliably holds the stateful coding gate — only unrestricted think-on scored 3/3, while caps (512/256/128) dropped to 1–2/3 and were non-monotonic (variance on the Step-2 trap dominated). So reasoning budgets are a *planning* latency lever, not a coding one; keep the coding route on unrestricted think-on.
* **The Real Speedup (dense only):** For raw decode speed without touching reasoning, **DFlash speculative decoding works on dense models** (see post-mortem #3 for why it fails on MoE) — 2.82× on the dense 27B.

### C. 122B MoE VRAM Spillover Hangs (Attempt 3)
* **What we tried:** Running `Qwen 3.5 122B MoE` (70.0 GB) with a large context size (32,768 tokens) on the 128 GB system.
* **Why it failed:** Although the base weights (70 GB) fit comfortably inside the 96 GB GTT limit, scaling the context window to 32k requires a massive KV cache allocation in graphics memory. This context allocation exceeded the 96 GB limit, causing GPU allocations to spill over into general system RAM. This triggered kernel driver conflicts, resulting in GPU ring timeouts and system freezes.
* **The Solution:** Pinned the maximum context size of the 122B model to **8,192 tokens** in the configuration script. This keeps memory consumption within the GTT limit and prevents driver hangs.

### D. Speculative Decoding Spec-Defect (`--spec-dec` Crashes)
* **What we tried:** Enabling speculative decoding flags directly inside the llama-server invocation for MoE models.
* **Why it failed:** The spec-dec engine failed to correctly load and synchronize the tokenizers of the draft model and the MoE model, resulting in parsing mismatch errors and immediate server crashes.
* **The Lesson:** Do not attempt speculative decoding on **MoE** architectures; it is functionally counterproductive due to the routing latency penalty. **The opposite holds for dense models:** on the dense Qwen 3.6 27B, DFlash speculative decoding delivers **2.82× (≈31 tok/s)** precisely because a dense model has no expert router to thrash during draft verification. Match the acceleration technique to the architecture: reasoning budgets for MoE latency, speculative decoding for dense throughput.
