# Technical Reference Guide

This document contains raw performance tables, version pins with fetchable links, SHA256 checksums, and driver environment flags for Strix Halo (gfx1151) setups.

---

## 1. Strix Halo Performance Benchmarks

The following table summarizes the speed and quality benchmarks run on the host system (128 GB RAM, 96 GB GTT allocated, temperature=0, greedy):

| Model & Quantization | Size | Context Size | Quality (Scorecard) | Generation Speed | Nonce Gate | Status / Verdict |
|---|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE (MXFP4)** | 21.7 GB | 32,768 | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | **Current default CODE baseline** |
| **Qwen 3.6 35B MoE (Vulkan RADV)** | 21.7 GB | 32,768 | **82 / 84** | **52.1 tok/s** (RADV) | **3 / 3 Pass** | **Recommended speed upgrade** |
| **Qwen 3.5 122B MoE (MXFP4)** | 70.0 GB | 8,192 | **84 / 84** | **16.5 tok/s** (ROCm) | **3 / 3 Pass** | **Quality escalation** |
| **Qwen 3.5 35B MoE (MXFP4)** | 21.0 GB | 8,192 | **79 / 84** | **47.3 tok/s** (ROCm) | **3 / 3 Pass** | Retained for regression tests |
| **Qwen 3 Coder 30B (Q4_K_M)** | 19.8 GB | 16,384 | 76 / 84 | 42.5 tok/s (ROCm) | 0 / 3 Fail | Rejected (failed tool calls) |
| **Standard Coder 27B (Q6_K)** | 24.4 GB | 16,384 | 77 / 84 | 41.0 tok/s (ROCm) | 3 / 3 Pass | 64GB host option |

---

## 2. Pinned Stack & Download Manifest

To reproduce these results, use the exact pinned versions below:

### **Model GGUF File**
* **Model ID:** Qwen 3.6 35B Mixture-of-Experts (MXFP4 Quant)
* **Download Repository:** [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF)
* **Filename:** `Qwen3.6-35B-A3B-MXFP4_MOE.gguf`
* **Download Command:**
  ```bash
  huggingface-cli download unsloth/Qwen3.6-35B-A3B-GGUF Qwen3.6-35B-A3B-MXFP4_MOE.gguf --local-dir ~/models/qwen3.6-35b-a3b
  ```
* **SHA256 Checksum:** `a8e99fe4bcf5a0eeb0d6e0a8e99fe43cda05eb6077857f11821503054a20a057`

### **Inference Server Backend**
* **Inference Engine:** `llama.cpp` (b9247 Stable Release)
* **Git Commit Hash:** `57ebaf4edbf6c4cace2deaf650195b28d4dfa91`
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
