# Chapter 08: Speed and Tuning Optimizations

Once your local model is serving correctly, you can optimize its performance. This chapter covers batch sizes, building the Vulkan backend, and fine-tuning reasoning budgets.

---

## 1. The Reasoning Token Bottleneck

In reasoning models, generating the thinking process consumes most of the execution time. 

The bar chart below breaks down the wall-clock time spent during a single agent step:

![Decode Breakdown](../assets/decode_breakdown.png)

As shown, the prefill phase (loading the prompt) and the final content delivery are incredibly fast. The bottleneck is the **Reasoning Decode Phase** (where the model "thinks" before answering). 

To optimize system performance, we target this bottleneck directly.

---

## 2. Setting Reasoning Budgets

Instead of disabling thinking completely, you can cap the number of reasoning tokens the model is allowed to generate per request. This preserves reasoning quality for difficult steps while saving execution time.

### **The Request-Level Lever: `thinking_budget_tokens`**
You can set this parameter directly inside the API request payload (or in your agent's config profile):
```yaml
# Inside your agent settings:
thinking_budget_tokens: 256
```
This forces the model to wrap up its thinking trace and output its final answer once the cap is reached. Because it is configured per-request, your system can automatically adjust budgets:
* **High budget (e.g. 1024):** For drafting a long planning brief or research summary.
* **Low budget (e.g. 128):** For checking sensor logs or formatting simple statuses.

> [!WARNING]
> **Do not cap thinking on stateful, multi-step tasks.** In our testing, *any* budget cap caused the model to drop details it needed to carry between steps and fail the multi-step coding gate — only uncapped thinking held the result. Reasoning budgets are a latency win for single-shot planning and prose, not for chained agent loops. When in doubt, leave it uncapped.

For gpt-oss-120B, the important public-facing rule is simpler: use a system prompt that asks for a draft with clearly labeled assumptions. Before that prompt fix, the model often deflected into a checklist of missing inputs; after it, the same model became the measured quality baseline.

### **The Global Server Lever: `--reasoning-budget N`**
You can also cap reasoning globally when launching the model server:
```bash
# Set a global cap of 512 tokens per request
serve_rocm.sh --reasoning-budget 512
```

---

## 3. Opt-in to Vulkan (RADV) for +15% Speed

AMD APUs can run models faster using the open-source **Vulkan (RADV)** driver instead of the default ROCm package.

### **How to build llama-server with Vulkan support:**
```bash
# Clone the llama.cpp project matching the stable release (<LEMONADE_BUILD_TAG>)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
git checkout <LEMONADE_BUILD_TAG>

# Build using Vulkan cmake flags
cmake -B build-vulkan -DGGML_VULKAN=ON
cmake --build build-vulkan --config Release --target llama-server
```

### **How to Serve using Vulkan:**
1. Update `scripts/config.env` and set `TESLA_VULKAN_SERVER` to the path of your newly compiled `llama-server` binary.
2. Launch the server using our wrapper:
   ```bash
   bash scripts/serving/serve_vulkan.sh
   ```
This script automatically exports `HIP_VISIBLE_DEVICES=-1` (hiding the GPU from ROCm, forcing Vulkan selection) and sets the ICD to `RADV` (Mesa Vulkan driver). Retesting shows a **+13% to +19% speedup** in token decoding with zero quality loss.

### Decode Speed Reference

All values below are local Strix Halo results from the verified stack. Not universal model rankings. Sorted by decode speed (fastest first); quality lane labels are for routing, not ranking.

**Verified stack entries:**

| Model | Decode speed | Quality lane |
|---|---:|---|
| Qwen 3.6 35B-A3B MXFP4 (Vulkan/RADV) | **50.1 tok/s** | CODE/general baseline |
| Qwen 3.5 35B-A3B MXFP4 (ROCm) | 47.3 tok/s | retained for regression tests |
| gpt-oss-120B MXFP4 (Vulkan/RADV) | **~46 tok/s** | QUALITY baseline |
| Qwen 3.6 35B-A3B MXFP4 (ROCm fallback) | ~44.2 tok/s | CODE baseline ROCm fallback |
| Qwen3-Coder-Next UD-Q4_K_XL (ROCm) | 34.6 tok/s | hard-coding challenger |
| Qwen 3.5 122B-A10B MXFP4 (ROCm) | ~19.4 tok/s | QUALITY spot-specialist |
| Qwen 3.6 27B Dense UD-Q4_K_XL | 9.6–11.5 tok/s normal decode | break-glass only |
| **Gemma 4 31B IT Q6_K (Vulkan/RADV)** | **~8.25 tok/s tg128; ~7.7 tok/s sustained** | second-opinion lane (dense — see note) |

**Unverified / queued candidates** *(speed numbers sourced from private benchmarks not reproduced in this public repo — treat as directional only):*

| Model | Reported speed | Status |
|---|---:|---|
| Gemma 4 26B-A4B UD-Q6_K_XL | 40.11 tok/s mean *(not verified in public repo)* | Queued candidate — coding gate cleared, not Stable Stack |

> [!NOTE]
> **Why is Gemma 4 31B the slowest model in the verified stack?** Both Gemma 31B and Qwen 35B are roughly 25 GB in size, yet Qwen 35B runs ~6× faster on the same hardware. The reason is architecture: Qwen 35B is a Mixture-of-Experts model that activates only ~3B parameters per token, so each decode step reads far less weight data from memory. Gemma 31B is a **dense** model: every token requires reading all 31B parameters from the same bandwidth-constrained unified memory. On a memory-bandwidth-bound APU like Strix Halo, that difference collapses decode speed from ~50 tok/s (MoE) to ~8 tok/s (dense). Gemma 31B earns its place in the stack as a second-opinion lane for quality verification and cross-family comparison — not as a throughput model. Use it on the orchestrated path where quality of each step matters more than wall-clock time.

---

## 4. Tuning Batch Sizes

The server's logical batch size (`--batch-size`) and physical micro-batch size (`--ubatch-size`) control how prompt segments are loaded into memory.
* For Strix Halo APUs, keep both set to **`2048`**.
* *Why:* Setting these values higher consumes excessive unified graphics memory, which can lead to system hangs. Setting them lower slows down the prefill phase (loading long prompts).
