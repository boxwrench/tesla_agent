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

The following models are used in the reference tests. Download paths are pinned to public Hugging Face repositories.

> **About the checksums:** these are `sha256sum` of the maintainer's local single-file GGUFs — use them to verify your own download is bit-identical (`sha256sum <file>`). Unsloth occasionally re-quantizes, so a live HF file may differ; treat a mismatch as "version drift," not corruption. The 122B is not currently on local disk, so its hash is unpinned — verify against the source repo.

| Model Identity | Format & Quant | File Name | Size (GB) | HF Source Repository | SHA256 (local copy) |
|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE** | GGUF (MXFP4) | `Qwen3.6-35B-A3B-MXFP4_MOE.gguf` | 21.7 GB | [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF) | `2fdd20997c4d88ee25f70f500c61f8b999378d92ab055f9d450fc70d617158d3` |
| **Gemma 4 31B IT** | GGUF (Q6_K) | `gemma-4-31B-it-Q6_K.gguf` | 25.2 GB | Unsloth GGUF release | `abd0be03a2bc3f3c9d8e018cbb4ff5b553c340c65d49b6b346c48be5a1efde28` |
| **gpt-oss-120B** | GGUF (MXFP4, 3 shards) | `gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf` | ~63 GB | Unsloth GGUF release | shard pins below |
| **Qwen 3.5 122B MoE** | GGUF (MXFP4) | `Qwen3.5-122B-A10B-MXFP4_MOE.gguf` | 70.0 GB | [unsloth/Qwen3.5-122B-A10B-GGUF](https://huggingface.co/unsloth/Qwen3.5-122B-A10B-GGUF) | *(unpinned — not on local disk; verify against source)* |
| **Gemma 4 26B-A4B IT** | GGUF (UD-Q6_K_XL) | `gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf` | 21.2 GB | Unsloth GGUF release | `5cfb7ab424c01388538005f26573f3bd374d3140cc021a1c44249e69928882a4` |
| **Qwen3-Coder-Next** | GGUF (UD-Q4_K_XL) | `Qwen3-Coder-Next-UD-Q4_K_XL.gguf` | 49.6 GB | [unsloth/Qwen3-Coder-Next-GGUF](https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF) | `4bb93f0a0221ef4ff963ca9094df629c8dfdfabc3b4fdd85c1a2e4c0624fce36` |
| **Qwen 3.5 35B MoE** | GGUF (MXFP4) | `Qwen3.5-35B-A3B-MXFP4_MOE.gguf` | 21.0 GB | [unsloth/Qwen3.5-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF) | `0f135a59159030f4710477abc6f9922d2f13552c85bff736deaaef71023cd770` |

### gpt-oss-120B MXFP4 per-shard SHA256

```text
gpt-oss-120b-mxfp4-00001-of-00003.gguf  e2865eb6c1df7b2ffbebf305cd5d9074d5ccc0fe3b862f98d343a46dad1606f9
gpt-oss-120b-mxfp4-00002-of-00003.gguf  346492f65891fb27cac5c74a8c07626cbfeb4211cd391ec4de37dbbe3109a93b
gpt-oss-120b-mxfp4-00003-of-00003.gguf  66dca81040933f5a49177e82c479c51319cefb83bd22dad9f06dad45e25f1463
```

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
| **gpt-oss-120B MXFP4** — QUALITY baseline | **Vulkan RADV** | **Pairwise 5-1 vs Qwen 35B; 4-2 vs Qwen 122B** | **~46 tok/s** | not captured in stable run | ~63 GB | **3 / 3 Pass** |
| **Gemma 4 31B IT Q6_K** — second-opinion lane (dense — slow decode) | **Vulkan RADV** | **Pairwise 4-2 vs Gemma 26B-A4B** | **~8.25 tok/s tg128; ~7.7 tok/s sustained long completions** | pp8192 ~133.6 tok/s (verified) | 25.2 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** — **default** | **Vulkan RADV** | **82 / 84** | **50.1 tok/s** | **932.1 tok/s** | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** — fallback | ROCm 7.2.x | **82 / 84** | **44.2 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-Off)** | ROCm 7.2.x | **82 / 84** | **43.7 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-On)** — QUALITY spot-specialist | ROCm 7.2.x | **80 / 84** | **19.4 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-Off)** | ROCm 7.2.x | **81 / 84** | **19.5 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Gemma 4 26B-A4B IT UD-Q6_K_XL** *(queued, not Stable Stack)* | Vulkan RADV | **Pairwise 2-4 vs Gemma 31B** | **40.11 tok/s mean** *(not independently verified in public repo — sourced from private benchmarks; treat as directional)* | not captured in stable run | 21.2 GB | **3 / 3 Pass** |
| **Qwen 3.6 27B Dense (Think-On)** *(experimental, not in stack)* | ROCm/Vulkan tested (UD-Q4_K_XL) | **0-6 vs Qwen 122B** | **9.6-11.5 tok/s** tested normal decode | not captured in stable run | 16.4 GB | **3 / 3 Pass** (coding 3/3) |
| **Qwen 3.6 27B Dense (Think-Off)** *(experimental, not in stack)* | ROCm/Vulkan tested (UD-Q4_K_XL) | — | **9.6-11.5 tok/s** tested normal decode | not captured in stable run | 16.4 GB | **3 / 3 Pass** (coding 1/3) |
| **Qwen 3.6 27B Dense + DFlash spec.** *(experimental)* | Lucebox HIP (Q4_K_M draft) | — | **~31.3 tok/s (2.82×)** | see acceptance table below | ~16 GB | discipline-limited |
| **Qwen 3.5 35B MoE (Think-On)** | ROCm 7.2.x | **79 / 84** | **47.3 tok/s** | ~562.9 tok/s | 21.0 GB | **3 / 3 Pass** |
| **Qwen3-Coder-Next (Think-On)** | ROCm 7.2.x | — | **34.6 tok/s** | ~127.0 tok/s | 49.6 GB | **3 / 3 Pass** |

> **Stable Stack update (2026-05-30):** gpt-oss-120B is now the general QUALITY baseline after blinded pairwise wins of 5-1 vs Qwen 35B and 4-2 vs Qwen 122B. Qwen 122B is retained as a QUALITY spot-specialist for regulatory-currency work and sharp plan reviews. Gemma 4 31B is the cross-family second-opinion lane (coding experiment — quality verification, not throughput); Gemma 26B-A4B cleared the coding gate but did not graduate based on the quality pairwise result (2-4 loss to Gemma 31B). **Speed correction:** a previous draft listed Gemma 31B at 43-48 tok/s, which was a misattribution of the gpt-oss-120B Vulkan speed. Verified Gemma 31B decode is ~8.25 tok/s tg128 / ~7.7 tok/s sustained (dense model; full weights read every token). For tasks where decode speed matters, prefer Qwen 3.6 35B MoE (~50 tok/s Vulkan) or gpt-oss-120B (~46 tok/s Vulkan).
>
> **Status: the dense Qwen 3.6 27B is benchmarked but NOT in the production stack.** Community consensus often treats it as a strong reasoner, but local Strix Halo testing did not support that routing choice: blind pairwise was 0-6 vs the 122B on the standard 6-prompt set, and normal decode tested around 9.6-11.5 tok/s across backends. It is retained as a break-glass *"arrow in the quiver"* for tough, blocked projects — not a first- or second-line model. The speculative-decoding result below is kept as a technical finding.
>
> **DFlash speculative decoding on the dense 27B** lifts the dense route to **~31.3 tok/s (2.82×)** using a footprint-minimized Q4_K_M draft (HumanEval 2.57×, mean acceptance length 6.67, DDTree budget 22 — the gfx1151 sweet spot). Counter-intuitively the *smaller* Q4_K_M draft (1.03 GB) beats a larger Q8_0 draft (1.84 GB, only 1.49×): on this bandwidth-bound APU the draft's own weight reads compete for the same memory bus the target needs to verify, so minimizing draft footprint wins. This is the inverse of the MoE speculative-decoding result (post-mortem #3) — speculation succeeds on **dense** models because there is no expert router to thrash. *Speed is verified; pairing this speed with full tool-call discipline on the same Q4_K_M build is still in validation (the verified 27B tool-call/coding passes above are on the UD-Q4_K_XL build).*

### D. Prefill and Speculative-Acceptance Coverage

The table above keeps missing instrumentation explicit. Decode rates are the main stable-run metric for the newly added Gemma and gpt-oss rows; prefill was not captured in those stable gate records. A separate research note mentions a gpt-oss prompt-processing figure, but because it is not tied to the stable graduation protocol used above, it is not promoted into this matrix.

| Metric | Model / configuration | Captured value | Notes |
|---|---|---:|---|
| Prefill speed | Qwen 3.6 35B-A3B MXFP4, Vulkan/RADV | 932.1 tok/s | `pp8192` benchmark |
| Prefill speed | Qwen 3.6 35B-A3B MXFP4, ROCm | ~628.1 tok/s | `pp8192` benchmark |
| Prefill speed | Qwen 3.5 122B-A10B MXFP4, ROCm | ~136.0 tok/s | quality route benchmark |
| Prefill speed | Qwen 3.5 35B-A3B MXFP4, ROCm | ~562.9 tok/s | planning route benchmark |
| Prefill speed | Qwen3-Coder-Next UD-Q4_K_XL, ROCm | ~127.0 tok/s | coding challenger benchmark |
| Prefill speed | gpt-oss-120B MXFP4, Gemma 4 26B-A4B | not captured | rerun under the same protocol before publishing a value |
| Prefill speed | Gemma 4 31B IT Q6_K | **pp8192 ~133.6 tok/s** (controlled local GPU benchmark, b9247 57ebaf4e) | verified; decode ~8.25 tok/s tg128, ~7.7 tok/s sustained |
| Speculative acceptance length | Qwen 3.6 27B Dense + Q4_K_M DFlash draft | AL = 6.67 | HumanEval mean at DDTree budget 22 |
| Speculative acceptance percentage | Qwen 3.6 27B Dense + Q4_K_M DFlash draft | not captured | do not derive a percent from AL; rerun if acceptance-rate counters are needed |
| Speculative acceptance length | Qwen 3.6 27B Dense + Q8_0 DFlash draft | not captured | speedup was captured, but AL / acceptance percent were not |

DDTree budget sweep for the dense 27B Q4_K_M draft:

| Budget | Mean acceptance length | Decode speed |
|---:|---:|---:|
| 8 | 4.56 | 26.26 tok/s |
| 16 | 5.59 | 24.22 tok/s |
| 22 | 6.67 | 27.99 tok/s |
| 32 | 6.69 | 23.68 tok/s |
| 45 | 6.72 | 22.64 tok/s |
| 64 | 7.06 | 17.62 tok/s |

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
* **The Solution:** Pinned the maximum context size of the 122B model to a safe **12,288 tokens** (verified working cap; an 8k–12k range stays inside the GTT limit). This keeps memory consumption within the GTT limit and prevents driver hangs.

### D. Speculative Decoding Spec-Defect (`--spec-dec` Crashes)
* **What we tried:** Enabling speculative decoding flags directly inside the llama-server invocation for MoE models.
* **Why it failed:** The spec-dec engine failed to correctly load and synchronize the tokenizers of the draft model and the MoE model, resulting in parsing mismatch errors and immediate server crashes.
* **The Lesson:** Do not attempt speculative decoding on **MoE** architectures; it is functionally counterproductive due to the routing latency penalty. **The opposite holds for dense models:** on the dense Qwen 3.6 27B, DFlash speculative decoding delivers **2.82× (≈31 tok/s)** precisely because a dense model has no expert router to thrash during draft verification. Match the acceleration technique to the architecture: reasoning budgets for MoE latency, speculative decoding for dense throughput.
