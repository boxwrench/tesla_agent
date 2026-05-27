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
> * **Inference Engine:** llama.cpp/llama-server (`b9247`) stable backend
> * **Parameters & Drivers:** Temp = 0 (greedy decoding), context buffer = 8,192 to 32,768, Flash Attention enabled, run via ROCm 7.2.x (HIP) and Mesa/RADV Vulkan (Mesa 25.2.8).

| Model & Quantization | Size | Context Size | Quality (Scorecard) | Generation Speed | Nonce Gate | Status / Verdict |
|---|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE (Vulkan RADV)** | 21.7 GB | 32,768 | **82 / 84** | **50.1 tok/s** (RADV) | **3 / 3 Pass** | **Default CODE workhorse** (promoted; +51% prefill, +13.5% decode vs ROCm) |
| **Qwen 3.6 35B MoE (ROCm)** | 21.7 GB | 32,768 | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | ROCm fallback backend |
| **Qwen 3.5 122B MoE (MXFP4)** | 70.0 GB | 12,288 | **80 / 84** | **19.4 tok/s** (ROCm) | **3 / 3 Pass** | **Quality escalation** |
| **Qwen 3.5 122B MoE (MXFP4)** *think-off* | 70.0 GB | 12,288 | **81 / 84** | **19.5 tok/s** | **3 / 3 Pass** | Holds 3/3 coding even think-off |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-on* | 16.4 GB | 32,768 | — | **~7.0 tok/s** (ROCm) | **3 / 3 Pass** | Capability asset; coding 3/3. DFlash speculative → ~31 tok/s (2.82×) |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** *think-off* | 16.4 GB | 32,768 | — | **~7.0 tok/s** | **3 / 3 Pass** | Falls to 1/3 coding (reasoning load-bearing) |
| **Qwen 3.5 35B MoE (MXFP4)** | 21.0 GB | 8,192 | **79 / 84** | **47.3 tok/s** (ROCm) | **3 / 3 Pass** | Retained for regression tests |
| **Qwen3-Coder-Next (UD-Q4_K_XL)** | 49.6 GB | 16,384 | — | 34.6 tok/s (ROCm) | 3 / 3 Pass | CODE challenger (128GB-class) |

---

## 2. Pinned Stack & Download Manifest

To reproduce these results, use the exact pinned versions below:

### **Model GGUF File**
* **Model ID:** Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)
* **Download Repository:** `<MODEL_HF_REPO>`
* **Filename:** `<MODEL_FILENAME>`
* **Download Command:**
  ```bash
  huggingface-cli download <MODEL_HF_REPO> <MODEL_FILENAME> --local-dir ~/models/qwen3.6-35b-a3b
  ```
* **SHA256 Checksum:** `<SHA256_TBD>`

### **Inference Server Backend**
* **Inference Engine:** `llama.cpp` (<LEMONADE_BUILD_TAG> Stable Release)
* **Git Commit Hash:** `<LEMONADE_COMMIT_HASH_TBD>`
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
* `--cache-type-k q8_0` & `--cache-type-v q8_0`: Quantizes the key/value cache to save graphics memory.
* `--batch-size 2048` & `--ubatch-size 2048`: Recommended chunk limits.
* `--parallel 1`: Limits parallel execution slots (required for stable tool calling).
