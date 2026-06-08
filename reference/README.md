# Technical Reference Guide

This document contains raw performance tables, version pins with fetchable links, SHA256 checksums, and driver environment flags for Strix Halo (gfx1151) setups.

> [!TIP]
> For seasoned developers seeking complete reproducibility metrics, exact methodology descriptions, and post-mortems of failed attempts (such as vLLM compilation timeouts and MoE speculative decoding overhead), see the [Reproducibility Matrix & Deep-Dive](reproducibility-matrix.md).

Use this reference as the public source of truth for measured rows. The README,
guide chapters, and web dashboard summarize these values; if numbers conflict,
fix this reference first and then mirror the summary copies.

For the full folder map and canonical-source rules, see
[Repository Map and Canonical Sources](../REPO_MAP.md).

---

## 1. Strix Halo Performance Benchmarks

The following table summarizes the speed and quality benchmarks run on the host system:

> [!NOTE]
> **Benchmark Environment Stack:**
> * **Hardware:** AMD Ryzen Strix Halo APU (gfx1151), 128 GB LPDDR5X RAM (96 GB GTT memory pool allocated)
> * **Inference Engine:** llama.cpp/llama-server (`b9247`) stable backend; opt-in MTP lanes reproduced on `b9360`, with Gemma QAT MTP probes on Atomic `b9019`
> * **Parameters & Drivers:** Temp = 0 (greedy decoding), context buffer = 8,192 to 32,768, Flash Attention enabled, run via ROCm 7.2.x (HIP) and Mesa/RADV Vulkan (Mesa 25.2.8).

| Model & Quantization | Size | Context Size | Quality Evidence | Generation Speed | Nonce Gate | Status / Verdict |
|---|---|---|---|---|---|---|
| **gpt-oss-120B MXFP4 (3 shards)** | ~63 GB | 32,768 | **5-1 vs Qwen 35B; 4-2 vs Qwen 122B** | **~46 tok/s** (RADV) | **3 / 3 Pass** | **QUALITY baseline (general)**; requires the draft-with-assumptions system prompt to avoid checklist deflection |
| **Gemma 4 31B IT Q6_K** | 25.2 GB | 32,768 | **4-2 vs Gemma 26B-A4B** | **~8.25 tok/s tg128; ~7.7 tok/s sustained** (Vulkan; pp8192 ~133.6 tok/s) | **3 / 3 Pass** | **Second-opinion lane (dense — slow decode)**; orchestrated coding path required |
| **Qwen 3.6 35B MoE (Vulkan RADV)** | 21.7 GB | 32,768 | **82 / 84** | **~58.5 tok/s** (RADV) | **3 / 3 Pass** | **CODE/general baseline**; workhorse default unchanged |
| **Qwen 3.6 35B MoE MXFP4-MTP (Vulkan RADV)** | 19.3 GB | 32,768 | same production quant | **~72.7 tok/s** (+24%) | **3 / 3 Pass** | *Opt-in speed lane* via `--spec-type draft-mtp`; prefill not separately captured |
| **Qwen 3.6 35B MoE Q4_K_M-MTP (Vulkan RADV)** | 20.7 GB | 32,768 | **4-2 pairwise win** | **~81.2 tok/s** (+39%) | **3 / 3 Pass** | *Opt-in speed lane*; human-check regulatory figures; prefill not separately captured |
| **Qwen 3.6 35B MoE (ROCm)** | 21.7 GB | 32,768 | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | ROCm fallback backend |
| **Qwen 3.5 122B MoE (MXFP4)** | 70.0 GB | 12,288 | **80 / 84** | **19.4 tok/s** (ROCm) | **3 / 3 Pass** | **QUALITY spot-specialist** for regulatory currency and sharp plan reviews |
| **Qwen 3.5 122B MoE (MXFP4)** *think-off* | 70.0 GB | 12,288 | **81 / 84** | **19.5 tok/s** | **3 / 3 Pass** | Holds 3/3 coding even think-off |
| **Qwen 3.5 122B MoE MTP (MXFP4_MOE)** | ~70 GB | 12,288 | **3-3 quality tie vs previous MTP config** | **28.3 tok/s** (Vulkan; pp 324.9 tok/s) | **3 / 3 Pass** | Tuned 122B speed lane: `DRAFT_N=1`, `PMIN` unset; coding PASS 5/5 E2E |
| **StepFun Step-3.7-Flash MTP** | 88.79 GiB + 3.5 GB draft | 12,288 | Plain StepFun pairwise: **6-0 vs gpt-oss-soulfix; 4-0-2 vs 122B** | **27.9 tok/s** (Vulkan; pp 183.5 tok/s; wall std 78.0 s; ub=256) | **3 / 3 Pass** | Large-model QUALITY contender; independent calibration still needed before default promotion |
| **StepFun Step-3.7-Flash plain** | 88.79 GiB | 16,384 gate / 32,768 coding | **6-0 vs gpt-oss-soulfix; 4-0-2 vs 122B** | **20.4-22.3 tok/s** (Vulkan; pp 212.0 tok/s) | **3 / 3 Pass** | Large QUALITY contender baseline; coding 4/5 E2E |
| **Gemma 4 26B-A4B IT UD-Q6_K_XL** | 21.2 GB | 32,768 | **2-4 vs Gemma 31B** | **44.8 tok/s tg128; pp512 1002.8 tok/s** | **3 / 3 Pass** | **Verified plain-control baseline**; simpler lane for general reasoning/JSON/prose |
| **Gemma 4 26B-A4B QAT Q4_0** | 13.45 GiB | 32,768 | quality control vs non-QAT Q4 pending | **59.4 tok/s; pp 1194.4 tok/s** | **3 / 3 Pass** | **Fast Gemma QAT lane**; official Google QAT GGUF, best general Gemma speed row so far |
| **Gemma 4 26B-A4B QAT Q4_0 + MTP/Q8 KV** | 13.45 GiB + ~310 MiB assistant | 16,384 | experimental; assistant head is not QAT-matched | **71.0 tok/s; pp 714.4 tok/s** | **3 / 3 Pass** | Experimental single-stream speed lane; MTP acceptance 56.9%, lower two-slot throughput |
| **Gemma 4 12B QAT Q4_0** | 6.50 GiB | 32,768 | quality control pending | **25.7 tok/s; pp 666.5 tok/s** | not run | Compact QAT row; slower than 26B-A4B on this stack |
| **Gemma 4 31B QAT Q4_0** | 16.44 GiB | 32,768 | quality control pending | **11.0 tok/s; pp 204.2 tok/s** | not run | Dense QAT control; faster than prior Q6 but still memory-bound |
| **Gemma 4 31B QAT Q4_0 + MTP** | 16.44 GiB + ~337 MiB assistant | 16,384 | experimental; assistant head is not QAT-matched | **15.4 tok/s; pp 118.0 tok/s** | not run | Speed-only probe; MTP acceptance 42.5% |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-on* | 16.4 GB | 32,768 | 0-6 vs 122B | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in stack;* break-glass option. DFlash → ~31 tok/s (2.82×) |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-off* | 16.4 GB | 32,768 | — | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in stack* |
| **Qwen 3.5 35B MoE (MXFP4)** | 21.0 GB | 8,192 | **79 / 84** | **47.3 tok/s** (ROCm) | **3 / 3 Pass** | Retained for regression tests |
| **Qwen3-Coder-Next (UD-Q4_K_XL)** | 49.6 GB | 32,768 | orchestrated coding artifact: saved grader checks PASS | **44.4 tok/s** (Vulkan; pp 723.2 tok/s) | 3 / 3 Pass recorded | CODE challenger (128GB-class); Vulkan b9360 promoted |

**Recommendation note:** Qwen remains a strong and widely favored reasoning family, but this guide's default ladder follows the local Strix Halo agent gates. As of the 2026-06 update, gpt-oss-120B is the measured general QUALITY baseline, Qwen 3.6 35B remains the CODE/general baseline, Gemma 4 31B Q6 remains the dense second-opinion lane, and Gemma 4 26B-A4B QAT Q4_0 is the new fast Gemma lane at 59.4 tok/s decode / 1194.4 tok/s prefill. The QAT MTP rows are speed probes until QAT-matched assistant heads and quality controls are available.

---

## 2. Pinned Stack & Download Manifest

To reproduce these results, use the exact pinned versions below:

### **Model GGUF File**
The public setup guide starts with the 35B-class CODE baseline because it is the easiest reproducible lane for most 128 GB Strix Halo users. The full verified model set is listed in the reproducibility matrix.

* **Primary CODE baseline:** Qwen 3.6 35B-A3B MXFP4, SHA256 `2fdd20997c4d88ee25f70f500c61f8b999378d92ab055f9d450fc70d617158d3`
* **Opt-in MTP speed lane:** Qwen 3.6 35B-A3B MXFP4-MTP, SHA256 `1960416bb2cb9ec60cb297016b204ea73a70faaadf5401a62584e47ed2832c28`
* **Opt-in MTP speed lane:** Qwen 3.6 35B-A3B Q4_K_M-MTP, SHA256 `be11d472527e5013290b09c1afc12694a326a4184eb97cf58fff579a671dddc3`
* **Second-opinion lane (dense):** Gemma 4 31B IT Q6_K, SHA256 `abd0be03a2bc3f3c9d8e018cbb4ff5b553c340c65d49b6b346c48be5a1efde28`
* **QUALITY baseline:** gpt-oss-120B MXFP4, three shards with per-shard SHA256 pins in [reproducibility-matrix.md](reproducibility-matrix.md)
* **Large QUALITY contender:** StepFun Step-3.7-Flash UD-IQ4_XS plus optional `Step-3.7-Flash-MTP-Q8_0.gguf`; public source/checksum pins are still incomplete, so treat it as measured but not yet turnkey-reproducible from this public mirror alone.
* **Tuned 122B MTP speed lane:** Qwen 3.5 122B-A10B MTP MXFP4_MOE, `DRAFT_N=1`, `PMIN` unset; public source/checksum pin still pending.
* **Verified plain-control baseline:** Gemma 4 26B-A4B IT UD-Q6_K_XL, SHA256 `5cfb7ab424c01388538005f26573f3bd374d3140cc021a1c44249e69928882a4`
* **Fast Gemma QAT lane:** Gemma 4 26B-A4B IT QAT Q4_0, SHA256 `4c856523d61d77922dbc0b26753a6bf6208e5d69d80db0c04dcd776832d054c5`
* **Gemma QAT controls:** 12B QAT Q4_0, SHA256 `faff1a63667fac17ac5e777f47114688fcefea96e220e211aaa8d62c2c4561f1`; 31B QAT Q4_0, SHA256 `0374ce7b0124db9ba96fc649e835c531223ee224a497ce88a374baaea10932ec`

### **Inference Server Backend**
* **Inference Engine:** `llama.cpp` stable build `b9247`
* **Git Commit Hash:** `57ebaf4ed`
* **Primary backend (Vulkan/RADV):** built from source at tag `b9247` with Vulkan enabled — the default serving lane on Strix Halo:
  ```bash
  git clone https://github.com/ggerganov/llama.cpp
  cd llama.cpp && git checkout b9247
  cmake -B build-vulkan -DGGML_VULKAN=ON
  cmake --build build-vulkan --config Release --target llama-server
  ```
  Point `TESLA_VULKAN_SERVER` in `scripts/config.env` at `build-vulkan/bin/llama-server` and serve with `scripts/serving/serve_vulkan.sh`.
* **ROCm/HIP fallback:** the ROCm backend is retained as a tested fallback (`serve_rocm.sh`); build or supply a ROCm `llama-server` and set `TESLA_LLAMA_SERVER`.

---

## 3. Environment & Host Parameter List

These parameters configure the AMD GPU driver and `llama-server` runtime for memory stability:

### **GPU HSA Variables (`set_hsa_env.sh`)**
```bash
# Force compat mapping for Strix Halo gfx1151 APU
export HSA_OVERRIDE_GFX_VERSION=11.5.1

# Disable system DMA to prevent expert-routing hangs
export HSA_ENABLE_SDMA=0

# Configure memory allocations
export GPU_MAX_HEAP_SIZE=100
export GPU_MAX_ALLOC_PERCENT=100
export GPU_SINGLE_ALLOC_PERCENT=100
export GPU_FORCE_64BIT_PTR=1

# ROCm device visibility
export HIP_VISIBLE_DEVICES=0
```

### **Graphics Translation Table (GTT) Calculator**
To calculate parameters for `/etc/modprobe.d/amdgpu_llm_optimized.conf`:
* `gttsize` = System RAM (in GB) × 0.75 × 1024
* `pages_limit` = `gttsize` (in GB) × 1024 × 1024 × 1024 / 4096
* `page_pool_size` = `pages_limit` / 2

*Example (128 GB Host):*
```text
gttsize=98304
pages_limit=25165824
page_pool_size=12582912
```

### **Core llama-server flags**
Run models with the parameters below to prevent memory leaks and context degradation:
* `--gpu-layers all`: Offloads all calculations to graphics memory.
* `--no-mmap`: Prevents lazy loading disk crashes on large files.
* `--flash-attn on`: Accelerates self-attention operations.
* `--cache-type-k q8_0` & `--cache-type-v q8_0`: Quantizes the key/value cache to save graphics memory. *Gemma 4 default:* use unquantized F16 KV (`--cache-type-k f16 --cache-type-v f16`) for trusted rows. Older Gemma 4 ROCm tests showed severe KL-divergence with quantized KV, and Vulkan quantized-KV rows need quality checks before promotion. The Gemma 4 26B-A4B QAT MTP/Q8 row is published as an experimental speed probe, not as the trusted default.
* `--batch-size 2048` & `--ubatch-size 2048`: Recommended chunk limits.
* `--parallel 1`: Limits parallel execution slots (required for stable tool calling).
