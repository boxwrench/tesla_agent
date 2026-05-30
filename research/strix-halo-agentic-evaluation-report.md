# Comprehensive Agentic LLM Evaluation on AMD Strix Halo (128GB)

**Date:** May 24, 2026
**Hardware Profile:** AMD Ryzen AI Max+ 395 (Strix Halo), Radeon 8060S iGPU (`gfx1151`), 128 GB LPDDR5X Unified Memory.

This report synthesizes empirical benchmarks, backend stability data, and agentic tool-calling evaluations for running fully autonomous LLM loops on the Strix Halo architecture. **Crucially, it strictly distinguishes between models that have been locally verified on this exact stack (the Qwen family) and theoretical or community-reported targets.**

---

## 1. The Evaluation Bar: Agentic Reliability vs. Single-Shot

Many benchmarks measure "single-shot" throughput. For autonomous loops (where the model must reliably emit OpenAI-compatible `tool_calls` for a harness like Hermes to execute without human intervention), throughput alone is insufficient. 

### The "Nonce Gate" Test (Locally Verified)
To prove an agent can act autonomously on this hardware, it must pass the **3/3 Nonce Gate**. 
*   **The Test:** A script writes a random UUID to a temporary file. The model is asked to read the file using a `terminal` tool and report the contents. This is repeated 3 times.
*   **Pass Criteria:**
    1.  The inference engine logs `finish_reason=tool_calls`.
    2.  The model echoes the exact nonce.
    3.  **Crucially:** The response contains *no fenced shell code blocks*. (A common failure is the model "printing" the command inside markdown ` ```bash ` instead of invoking the tool payload).

**Example Evaluation:** Our baseline **Qwen 3.5 35B MoE** on Lemonade/llama.cpp successfully passed the 3/3 Nonce Gate, proving Strix Halo is capable of fully autonomous loops when configured correctly.

---

## 2. Locally Verified Data: The Qwen Family

The following throughput and stability data represents the models **actually tested and verified** for agentic loops on this specific 128GB hardware profile.

| Model | Total/Active Params | Target Quant | Backend | Speed (Decode) | Speed (Prefill/PP) | VRAM Footprint |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Qwen 3.5 35B MoE** | 35B / 3B | MXFP4 / UD-Q6 | `llamacpp:rocm` | **~50 - 81 tok/s**| - | ~18 GB |
| **Qwen 3.6 27B Dense** | 27B / 27B | Q4_K_M | Lucebox (DFlash) | **26.85 tok/s** | (PFlash 3x gain) | ~18 GB |
| **Qwen3-Coder-Next**| 80B / 3B | Q6_K / Q8_0 | Vulkan or ROCm | **20 - 40 tok/s** | ~127 tok/s | ~55 - 70 GB |
| **Qwen 3 Coder 30B**| 30.5B / 3.3B | UD-Q4_K_XL | Vulkan/RADV | **69.6 - 98.5 tok/s**| 435+ tok/s (FA) | ~18 - 61 GB |
| **Qwen 3.5 122B** | 122B / 10B | MXFP4 / UD-Q4 | `llamacpp:rocm` | **18 - 19 tok/s** | ~136 tok/s | ~70 - 81 GB |

---

## 3. Hardware & OS Baseline

To replicate the performance metrics and prevent system crashes during high-concurrency or long-context inference, the host workstation uses the following verified configurations:

*   **BIOS UMA Frame Buffer:** **4 GB** dedicated VRAM (stable middle ground, leaving 124GB for general CPU allocation and dynamic GTT scaling).
*   **IOMMU:** **Enabled** (`amd_iommu=on` active in kernel command line).
*   **Kernel Optimizations (/etc/modprobe.d/amdgpu_llm_optimized.conf):**
    ```text
    options amdgpu gttsize=98304
    options amdgpu no_system_mem_limit=1
    options ttm pages_limit=25165824
    options ttm page_pool_size=12582912
    ```
*   **Vulkan Driver:** Mesa **RADV** (default active driver on standard clean Linux desktop setups). The proprietary AMDVLK driver package is not installed or used.

---

## 4. What the Data Means: Key Evaluations & Examples

### A. MoE is King on Bandwidth-Bound Hardware
Because the APU shares LPDDR5X bandwidth with the CPU, reading massive dense matrices per token is punitive.
*   **The Data:** A dense 70B model crawls at extremely low speeds (~3.8 tok/s). An MoE of significantly larger total size (Qwen 3.5 122B-A10B) sustains **18-19 tok/s**. 
*   **The Evaluation:** For Strix Halo, always prioritize Mixture-of-Experts (MoE) models with low active parameter counts (N_active < 15B) to stay above the 18+ tok/s interactive threshold.

### B. Tool-Calling Format & "Tool Leaks"
A model being fast does not make it a good agent. Many models suffer from "Premature Stalls" or "Tool Leaks" (emitting raw JSON/XML instead of using the API format).
*   **The Fix:** For the locally tested Qwen models, deploying the **froggeric v19 Jinja template** explicitly solves the "Empty Think" poisoning that leads to markdown tool leaks. This was the critical factor in getting Qwen 3.5 35B to pass the Nonce Gate.

### C. The ROCm vs. Vulkan Split Reality
There is no single "best" backend for Strix Halo; it is currently highly model-dependent.
*   **ROCm Limitations:** ROCm 7.x on `gfx1151` currently lacks the `ggml_cuda_op_mul_mat` kernels required for **MXFP4** quantization at long contexts. Attempting to use MXFP4 past ~4k tokens on ROCm causes a hard driver abort.
*   **Vulkan/RADV Capabilities:** The Mesa **RADV** Vulkan driver serves as a potent alternative, pushing Qwen 3.6 35B to **50.13 tok/s** decode mean.
*   **The Evaluation:** Your stack must be dual-backend capable. Test both ROCm and Vulkan to determine peak stability for a given Qwen variant.

### D. Speed Enhancements: What Actually Works (Local Qwen Focus)
1.  **Flash Attention (`-fa on`):** **VERIFIED.** Essential for high-context runs. It significantly boosts prompt processing speeds across all tested Qwen models.
2.  **DFlash (Speculative Decoding):** **VERIFIED.** Works excellently for MoE models, yielding substantial speedups when paired with a highly optimized drafter.
3.  **MTP (Multi-Token Prediction):** **MIXED.** Works well for models with native MTP heads (like Qwen 3.6 27B), but `Qwen3-Coder-Next` lacks native MTP heads and will not benefit from llama.cpp's native MTP implementation.
4.  **`--no-mmap` flag:** **VERIFIED.** Prevents iGPU driver hangs and locks on RDNA 3.5 when models exceed 64GB.

---


## 6. Benchmarking Methodology

To ensure reproducibility, the token generation (tok/s) and prompt processing (PP) speeds reported for the Qwen family were captured using the following standardized methods:

*   **Throughput Measurement (`bench_luce_daemon.sh`):** Local tests rely on dedicated shell scripts that isolate the inference daemon from the network stack. Speeds are measured by sending a fixed payload and dividing the total generated tokens by the wall-clock time required for the generation phase.
*   **Context Window Standardization:** Unless otherwise noted, prompt processing (PP) speeds are tested at an 8k to 16k context depth. This is a realistic representation of an agentic loop carrying conversation history and tool schemas.
*   **Separation of Metrics:** We strictly separate **Decode Speed** (the autoregressive generation of tokens) from **Prompt Processing (Prefill) Speed**. This is critical because some engines (like DFlash/PFlash) specifically target prefill acceleration without drastically altering decode speed.
*   **Nonce Gate Tool Validation:** The core evaluation is the Hermes 3/3 Nonce Gate. A model is only marked as a "Proven Baseline" if it successfully completes 3 consecutive autonomous file-read operations without leaking shell commands into the generation stream.