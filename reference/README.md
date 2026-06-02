# Technical Reference Guide

This document contains raw performance tables, version pins with fetchable links, SHA256 checksums, and driver environment flags for Strix Halo (gfx1151) setups.

> [!TIP]
> For seasoned developers seeking complete reproducibility metrics, exact methodology descriptions, and post-mortems of failed attempts (such as vLLM compilation timeouts and MoE speculative decoding overhead), see the [Reproducibility Matrix & Deep-Dive](reproducibility-matrix.md).

---

## 1. Strix Halo Performance Benchmarks

The following table summarizes the speed and quality benchmarks run on the host system:

> [!NOTE]
> **Benchmark Environment Stack:**
> * **Hardware:** AMD Ryzen Strix Halo APU (gfx1151), 128 GB LPDDR5X RAM (96 GB GTT memory pool allocated)
> * **Inference Engine:** llama.cpp/llama-server (`b9247`) stable backend; opt-in MTP lanes reproduced on `b9360`
> * **Parameters & Drivers:** Temp = 0 (greedy decoding), context buffer = 8,192 to 32,768, Flash Attention enabled, run via ROCm 7.2.x (HIP) and Mesa/RADV Vulkan (Mesa 25.2.8).

| Model & Quantization | Size | Context Size | Quality Evidence | Generation Speed | Nonce Gate | Status / Verdict |
|---|---|---|---|---|---|---|
| **gpt-oss-120B MXFP4 (3 shards)** | ~63 GB | 32,768 | **5-1 vs Qwen 35B; 4-2 vs Qwen 122B** | **~46 tok/s** (RADV) | **3 / 3 Pass** | **QUALITY baseline (general)**; requires the draft-with-assumptions system prompt to avoid checklist deflection |
| **Gemma 4 31B IT Q6_K** | 25.2 GB | 32,768 | **4-2 vs Gemma 26B-A4B** | **~8.25 tok/s tg128; ~7.7 tok/s sustained** (Vulkan; pp8192 ~133.6 tok/s) | **3 / 3 Pass** | **Second-opinion lane (dense — slow decode)**; orchestrated coding path required |
| **Qwen 3.6 35B MoE (Vulkan RADV)** | 21.7 GB | 32,768 | **82 / 84** | **~58.5 tok/s** (RADV) | **3 / 3 Pass** | **CODE/general baseline**; workhorse default unchanged |
| **Qwen 3.6 35B MoE MXFP4-MTP (Vulkan RADV)** | 21.7 GB | 32,768 | same production quant | **~72.7 tok/s** (+24%) | **3 / 3 Pass** | *Opt-in speed lane* via `--spec-type draft-mtp`; prefill not separately captured |
| **Qwen 3.6 35B MoE Q4_K_M-MTP (Vulkan RADV)** | 35B-class | 32,768 | **4-2 pairwise win** | **~81.2 tok/s** (+39%) | **3 / 3 Pass** | *Opt-in speed lane*; human-check regulatory figures; prefill not separately captured |
| **Qwen 3.6 35B MoE (ROCm)** | 21.7 GB | 32,768 | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | ROCm fallback backend |
| **Qwen 3.5 122B MoE (MXFP4)** | 70.0 GB | 12,288 | **80 / 84** | **19.4 tok/s** (ROCm) | **3 / 3 Pass** | **QUALITY spot-specialist** for regulatory currency and sharp plan reviews |
| **Qwen 3.5 122B MoE (MXFP4)** *think-off* | 70.0 GB | 12,288 | **81 / 84** | **19.5 tok/s** | **3 / 3 Pass** | Holds 3/3 coding even think-off |
| **Gemma 4 26B-A4B IT UD-Q6_K_XL** | 21.2 GB | 32,768 | **2-4 vs Gemma 31B** | **40.11 tok/s** mean *(not independently verified in public repo)* | **3 / 3 Pass** | *Queued candidate only.* Coding gate cleared; not Stable Stack |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-on* | 16.4 GB | 32,768 | 0-6 vs 122B | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in stack;* break-glass option. DFlash → ~31 tok/s (2.82×) |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-off* | 16.4 GB | 32,768 | — | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in stack* |
| **Qwen 3.5 35B MoE (MXFP4)** | 21.0 GB | 8,192 | **79 / 84** | **47.3 tok/s** (ROCm) | **3 / 3 Pass** | Retained for regression tests |
| **Qwen3-Coder-Next (UD-Q4_K_XL)** | 49.6 GB | 16,384 | — | 34.6 tok/s (ROCm) | 3 / 3 Pass | CODE challenger (128GB-class) |

**Recommendation note:** Qwen remains a strong and widely favored reasoning family, but this guide's default ladder follows the local Strix Halo agent gates. As of the 2026-05-30 update, gpt-oss-120B is the measured general QUALITY baseline, Gemma 4 31B is the second-opinion lane (dense model — slow decode, ~8 tok/s; use on orchestrated path for quality verification), Qwen 3.6 35B remains the CODE/general baseline, and Qwen 122B moves to a spot-specialist role. The new MTP rows are opt-in speed lanes for the same Qwen 3.6 35B workhorse; they do not replace the default setup path.

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
* **Queued candidate:** Gemma 4 26B-A4B IT UD-Q6_K_XL, SHA256 `5cfb7ab424c01388538005f26573f3bd374d3140cc021a1c44249e69928882a4`

### **Inference Server Backend**
* **Inference Engine:** `llama.cpp` stable build `b9247`
* **Git Commit Hash:** `57ebaf4ed`
* **ROCm Stable Binary Package:** Downloaded via Lemonade backend manager:
  ```bash
  lemonade backends install llamacpp:rocm
  ```

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
* `--cache-type-k q8_0` & `--cache-type-v q8_0`: Quantizes the key/value cache to save graphics memory. *Gemma 4 Exception:* Do not use `q8_0`, `q4_0` or `turbo3` for Gemma 4. On ROCm, quantizing Gemma's KV cache introduces severe KL-divergence (up to 0.377) which degrades reasoning; on Vulkan, quantizing introduces kernel block-alignment corruption issues. Use unquantized F16 KV (`--cache-type-k f16 --cache-type-v f16`) instead.
* `--batch-size 2048` & `--ubatch-size 2048`: Recommended chunk limits.
* `--parallel 1`: Limits parallel execution slots (required for stable tool calling).
