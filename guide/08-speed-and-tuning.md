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
* **High budget (e.g. 1024):** For writing complex compliance code.
* **Low budget (e.g. 128):** For checking sensor logs or formatting simple statuses.

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

---

## 4. Tuning Batch Sizes

The server's logical batch size (`--batch-size`) and physical micro-batch size (`--ubatch-size`) control how prompt segments are loaded into memory.
* For Strix Halo APUs, keep both set to **`2048`**.
* *Why:* Setting these values higher consumes excessive unified graphics memory, which can lead to system hangs. Setting them lower slows down the prefill phase (loading long prompts).
