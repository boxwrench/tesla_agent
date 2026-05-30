# **High-Performance Orchestration of Reasoning-Enabled Architectures on AMD Unified Memory Platforms**

Local workstation deployment of frontier-class large language models has undergone a paradigm shift with the release of hybrid thinking networks and sparse mixture-of-experts (MoE) architectures.1 Executing these resource-intensive models on unified memory hardware, specifically the AMD Strix Halo system utilizing the gfx1151 instruction set architecture, presents distinct optimization, driver integration, and orchestration challenges.1 By analyzing serving backend capabilities on llama.cpp build b9247, evaluating tool-calling grammar constraints, exploring custom quantization strategies, and assessing driver-level compiler dynamics, this analysis provides a definitive engineering blueprint for local deployment.1

## **Source Quantization Selection and Deterministic File Pinning**

A successful deployment relies on precise weight configurations, verified publisher patterns, and strict file pinning protocols.1 Because modern reasoning models use complex routing and multi-token prediction heads, using unverified or deprecated GGUF files can lead to severe degradation of mathematical outputs and reasoning paths.7 Authoritative publishers such as unsloth and bartowski offer GGUF files compiled with optimized quantization tools, ensuring correct MoE expert tensor conversions and updated chat templates.10  
The target parallel ladder includes Google’s Gemma 4 26B-A4B Mixture-of-Experts, the dense Gemma 4 31B model, and OpenAI's open-weights gpt-oss-120b.1 Gemma 4 models feature context windows of up to 256K tokens.10 The 26B MoE variant utilizes 128 routed experts plus a single shared expert, activating approximately 3.8 billion parameters per token.3 This sparse design delivers reasoning capabilities competitive with dense 31B-class networks while executing at throughput levels closer to a 4B model.3 Meanwhile, the dense 31B model presents a uniform, high-latency processing overhead across all layers.3  
At the top tier, the 117B parameter gpt-oss-120b utilizes a 36-layer Mixture-of-Experts routing 5.1 billion parameters per token.13 It was natively trained with MXFP4 precision in its MoE layers, making the standard MXFP4\_MOE quant the optimal target for both syntax preservation and generation speed.13  
Quantization reissue and churn patterns typically occur in response to upstream template updates or the discovery of conversion bugs in the underlying tensor libraries.12 For instance, early Gemma 4 GGUFs compiled prior to build b8778 exhibit broken chat templates and corrupted expert routing tables.8 Additionally, utilizing a CUDA 13.2 runtime for model compilation must be avoided due to compiler-induced output degradation.12  
Deterministic model definitions, repository targets, file sizes, and pull commands are structured below:

| Model Identity | Target Quantization | Authoritative Publisher | Specific Filenames | Sharding and Split Configuration | File Size (Bytes) | Downstream Pull Instruction |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Gemma 4 26B A4B IT Thinking** 1 | Q6\_K 1 | bartowski 21 | gemma-4-26B-A4B-it-Q6\_K.gguf 11 | Single-file format (No Splits) 11 | ![][image1] 11 | huggingface-cli download bartowski/google\_gemma-4-26B-A4B-it-GGUF \--include "gemma-4-26B-A4B-it-Q6\_K.gguf" \--local-dir./ 11 |
| **Gemma 4 31B IT Thinking** 1 | Q6\_K 1 | bartowski 22 | gemma-4-31B-it-Q6\_K.gguf 23 | Single-file format (No Splits) 23 | ![][image2] 23 | huggingface-cli download bartowski/google\_gemma-4-31B-it-GGUF \--include "gemma-4-31B-it-Q6\_K.gguf" \--local-dir./ 11 |
| **gpt-oss 120B** 1 | MXFP4\_MOE 1 | second-state 21 | gpt-oss-120b-MXFP4\_MOE-00001-of-00003.gguf, gpt-oss-120b-MXFP4\_MOE-00002-of-00003.gguf, gpt-oss-120b-MXFP4\_MOE-00003-of-00003.gguf 24 | Multi-shard format (3 Shards) 24 | ![][image3] (Total Combined) 24 | huggingface-cli download second-state/gpt-oss-120b-GGUF \--include "gpt-oss-120b-MXFP4\_MOE-\*" \--local-dir./ 24 |

## **Unified Memory Architecture and Server Optimization on Build b9247**

Executing these memory-intensive models on the AMD Strix Halo APU (gfx1151) requires careful system configuration.1 Because unified memory structures dynamically allocate RAM between the host CPU and the integrated GPU, default operating system limits will throttle graphics memory allocations.25 This causes large models to fall back to slow system RAM page access.25  
To bypass these limits and allow the integrated GPU to map almost the entire unified physical memory space, the system-level GRUB boot configuration must be modified.5 Setting kernel limits via the bootloader allocates up to 120,000 MiB of functional Graphics Translation Table (GTT) mapping, which prevents dynamic memory throttling 5:

Bash  
GRUB\_CMDLINE\_LINUX\_DEFAULT="quiet splash ttm.pages\_limit=30720000 amdgpu.gttsize=120000"

After modifying the configuration, executing sudo update-grub and rebooting the workstation allocates approximately 120,000 MiB of GTT memory directly to the graphics engine, enabling complete offloading of larger quantization weights.5

### **Vulkan (Mesa RADV 25.2.8) versus ROCm 7.13.0 Backend Analysis**

The execution profiles of llama.cpp on gfx1151 vary widely between the Mesa RADV Vulkan implementation and the ROCm/HIP compilation stack.1 While ROCm offers optimal raw execution speeds for standard dense networks, it suffers from severe allocation instabilities when compiling and parsing sparse MoE layers, such as those present in gpt-oss-120b.25  
Testing indicates that when running gpt-oss-120b-MXFP4\_MOE on the ROCm backend, the runtime engine frequently encounters out-of-memory errors during parameter fitting.25 The ROCm driver often fails to map the dynamic sparse expert routing layers within virtual GPU boundaries on unified APU systems.25  
In contrast, the Mesa RADV Vulkan implementation compiles the graph successfully, loading the model at a stable VRAM footprint of approximately 67.5 GiB.25 Additionally, ROCm exhibits performance drops under high context scenarios on unified systems, whereas Vulkan remains comparatively stable across extended generation sequences.28

### **Model-Specific CLI Launch Parameters**

To maximize serving efficiency, prevent disk swapping, and ensure hardware-accelerated processing, specific CLI flags must be passed to the llama-server during startup 5:

* **Gemma 4 26B A4B IT:**  
  Bash  
  llama-server \\  
    \-m./gemma-4-26B-A4B-it-Q6\_K.gguf \\  
    \-c 65536 \\  
    \-ngl 999 \\  
    \-fa on \\  
    \-ub 2048 \\  
    \-b 2048 \\  
    \--cache-type-k q8\_0 \\  
    \--cache-type-v q8\_0 \\  
    \--no-mmap \\  
    \--host 0.0.0.0 \\  
    \--port 8080

  *Analysis:* Disabling memory mapping (--no-mmap) forces weight pinning in unified memory, avoiding latency from disk-to-RAM pagination.5 Flash attention (-fa on) uses the rocWMMA instruction set to speed up attention calculations.5 Quantizing the Key-Value cache (--cache-type-k q8\_0 and \--cache-type-v q8\_0) reduces memory usage during long-context execution with negligible loss in accuracy.30  
* **Gemma 4 31B IT:**  
  Bash  
  llama-server \\  
    \-m./gemma-4-31B-it-Q6\_K.gguf \\  
    \-c 32768 \\  
    \-ngl 999 \\  
    \-fa on \\  
    \-ub 2048 \\  
    \-b 2048 \\  
    \--cache-type-k q8\_0 \\  
    \--cache-type-v q8\_0 \\  
    \--no-mmap \\  
    \--host 0.0.0.0 \\  
    \--port 8081

  *Analysis:* Because this dense variant lacks MoE routing, it has higher processing latency.3 Setting the context limit to 32K prevents memory exhaustion during the prefill stage on the integrated GPU.3  
* **gpt-oss 120B:**  
  Bash  
  llama-server \\  
    \-m./gpt-oss-120b-MXFP4\_MOE-00001-of-00003.gguf \\  
    \-c 16384 \\  
    \-ngl 999 \\  
    \-fa on \\  
    \-ub 512 \\  
    \-b 512 \\  
    \-ot ".ffn\_.\*\_exps.=CPU" \\  
    \--cache-type-k q8\_0 \\  
    \--cache-type-v q8\_0 \\  
    \--no-mmap \\  
    \--host 0.0.0.0 \\  
    \--port 8082

  *Analysis:* The \-ot ".ffn\_.\*\_exps.=CPU" flag selectively offloads MoE expert tensors to the CPU while keeping self-attention and non-MoE layers on the GPU.30 This selectively manages memory under a strict unified memory envelope like 96 GiB GTT.1 Setting micro-batch limits (-ub 512 and \-b 512\) aligns evaluation cycles with the hardware's Compute Unit vector registers.7

## **Tool-Calling Protocols and Parser Integration in the Gemma 4 Family**

The Gemma 4 model family relies on special control tokens built directly into the vocabulary to manage reasoning and tool operations.31 This architecture replaces older, instruction-based prompt wrappers with native, hardware-level parser tags.33  
The structural foundation of the chat template uses specific turn boundaries and explicit role declarations.23 A multi-turn conversation is structured as follows 23:

\<bos\>\<|turn\>system  
\<turn|\>  
\<|turn\>user  
\[User Query / Payload\]\<turn|\>  
\<|turn\>model  
\<|channel\>thought

\<channel|\>

When thinking is active, the model generates its internal reasoning process within the \<|channel\>thought\\n and \<channel|\> tags.15 If reasoning is disabled (via the template parameter enable\_thinking: false), the model will output an empty thought block (\<|channel\>thought\\n\<channel|\>) and transition directly to the final response.14

\<|turn\>model  
\<|channel\>thought  
\<channel|\>  
The chemical formula for water is H2O.

### **Native Tool Call Enclosure Protocol**

Gemma 4 handles function-calling natively.31 To declare available functions, a system instruction or specialized tool token defines the schema, wrapping individual configurations inside designated boundary blocks 31:

\<|turn\>system  
\<|tool\>declaration:get\_weather{"description":"Get local weather data"}\<tool|\>\<turn|\>

When invoking a tool, the model outputs the call using the dedicated \<|tool\_call\> wrapper, applying the single \<|"|\> token to delimit strings and prevent parsing conflicts 31:

\<|turn\>model  
\<|tool\_call\>call:get\_weather{location:\<|"|\>Seattle, WA\<|"|\>}\<tool\_call|\>

The host application intercepts this sequence, executes the function, and feeds the response back inside \<|tool\_response\> tags 31:

\<|turn\>user  
\<|tool\_response\>response:get\_weather{temp:\<|"|\>55F\<|"|\>}\<tool\_response|\>\<turn|\>

### **Community-Reported Failures and Mitigation Strategies**

Deploying Gemma 4 within local pipelines has revealed several common integration issues:

* **Stray Thought Generation:** When thinking is disabled, the model may still generate empty or fragmented reasoning blocks.31 To stabilize this, applications should inject an empty thinking token to the chat template to guide the generation path.31  
* **GBNF Grammar Conflicts:** Standard llama.cpp context-free grammars (GBNF) are designed for clean JSON syntax.36 These conflict with Gemma 4’s proprietary function-calling notation, causing parsing failures.36  
* **Client Parser Failures:** Standard client-side integrations (such as LangChain's ChatLlamaCpp) often fail to process native tool tokens, treating tool calls as regular text.37 Pointing client libraries to the local llama-server via the Anthropic Messages API endpoint rather than the OpenAI completions route provides a more stable parsing path.37

### **Hermes Agent Integration Settings**

Integrating Gemma 4 into a Hermes Agent profile requires specific modifications to config.yaml to support the model's native formatting.38 Because local reasoning tasks require a large context window, the profile must explicitly configure the context space 39:

YAML  
\# \~/.hermes/profiles/gemma\_work/config.yaml  
model:  
  provider: "custom"  
  base\_url: "http://127.0.0.1:8080/v1"  
  default: "gemma-4-26B-A4B-it-Q6\_K"  
  context\_size: 65536  
  chat\_template\_kwargs:  
    enable\_thinking: true

The matching execution profile in the environment store requires the API service to be explicitly declared 40:

Bash  
\# \~/.hermes/profiles/gemma\_work/.env  
API\_SERVER\_ENABLED=true  
API\_SERVER\_PORT=8650  
API\_SERVER\_KEY=gemma-work-token

To secure workspace execution during local tool operations, the terminal backend is configured with a persistent Docker sandbox container 38:

YAML  
\# \~/.hermes/profiles/gemma\_work/config.yaml  
terminal:  
  backend: "docker"  
  docker\_image: "ubuntu:24.04"  
  docker\_volumes:  
    \- "\~/.hermes/cache:/workspace"

## **Harmony Template Structure and Channel Optimization in gpt-oss 120B**

OpenAI’s gpt-oss-120b relies on the custom Harmony chat format, which uses the o200k\_harmony tokenizer.13 The chat structure enforces strict channel hygiene, isolating reasoning, tool interactions, and final generation.13

### **Harmony Chat Structure and Context Insertion**

The Harmony format requires systematic role declarations and custom boundary tags 24:

\<|start|\>system\<|message|\>You are ChatGPT, a large language model trained by OpenAI. Knowledge cutoff: 2024-06. Current date: 2025-08-06  
Reasoning: medium  
\# Valid channels: analysis, commentary, final. Channel must be included for every message.\<|end|\>  
\<|start|\>user\<|message|\>Evaluate the limit of x^2 as x approaches 2.\<|end|\>  
\<|start|\>assistant\<|channel|\>analysis\<|message|\>  
The limit of x^2 as x approaches 2 can be found by direct substitution.   
Since f(x) \= x^2 is continuous everywhere, the limit is simply f(2).  
Evaluating f(2) gives 2^2 \= 4\.  
\<|end|\>\<|start|\>assistant\<|channel|\>final\<|message|\>The limit is 4.\<|end|\>

The Harmony template accepts a global parameter to adjust reasoning effort, giving developers control over response latency and thinking depth.30 The template maps this property using specific system string insertions 30:

Reasoning: {{.ThinkLevel }}

Valid configurations for this property are "low", "medium", and "high".30

### **Parser-Side Extraction and CoT Isolation**

The llama.cpp serving engine can natively parse and isolate these channels.45 Launching llama-server with \--jinja and \--reasoning-format auto configures the engine to process the Harmony format.45 When configured, the server extracts the analysis channel block and returns it in the API response inside the standard reasoning\_content field.45 This separates thinking logs from final text outputs, preventing raw parsing tags from leaking to end users.45  
However, applying GBNF grammar constraints can interfere with this parsing process.45 Because llama.cpp applies grammars *before* filtering out Harmony tags, custom schema files must explicitly model the Harmony tokens.45 Neglecting this formatting causes the execution engine to hang 45:

Code snippet  
\# Correct grammar constraint incorporating Harmony wrappers  
root ::= "\<|channel|\>analysis\<|message|\>" \[^\<\]\* "\<|end|\>\<|start|\>assistant\<|channel|\>final\<|message|\>" ("Yes" | "No")

Within the Hermes Agent ecosystem, the profile must connect using an OpenAI-compatible connection string.39 This connection targets the Harmony prompt template using LlamaEdge or an equivalent middleware wrapper to handle channel separation 18:

YAML  
\# \~/.hermes/profiles/oss\_120b/config.yaml  
model:  
  provider: "custom"  
  base\_url: "http://127.0.0.1:8082/v1"  
  default: "gpt-oss-120b-MXFP4\_MOE"  
  context\_size: 16384  
  chat\_template\_kwargs:  
    reasoning\_effort: "high"

## **Quantization Trade-offs and KV Cache Memory Constraints**

Executing large models on unified memory platforms requires balancing computational speed, memory usage, and model quality.1

### **Structural Floor of the Gemma 4 Family**

While the lossless Q6\_K quant represents the highest quality target for dense architectures, Q4\_K\_M or Unsloth's dynamic UD-Q4\_K\_XL serves as the optimal baseline for the Gemma 4 MoE (26B) variant.3 Because MoE layers route tokens to only 8 active experts per pass, the model achieves inference speeds comparable to a 4B parameter model.3  
Deploying Q4\_K\_M delivers excellent prompt processing speeds of approximately 500 to 600 tokens per second, with text generation reaching 20 tokens per second.16 In contrast, dense 31B execution at high quantizations drops performance to roughly 3 to 4 tokens per second, making it less practical for real-time workflows.16

### **Post-Trained Native Precision vs. Intermediary Quantization**

For gpt-oss-120b, standard quantization configurations like Q6\_K or Q4\_K\_M should be avoided.49 The model’s Mixture-of-Experts layers were post-trained natively with MXFP4 precision, resulting in weights quantized to 4.25 bits per parameter.13  
Because the base network is optimized around this representation, applying standard integer quantization pipelines degrades the routing pathways.49 This causes syntax errors during tool-calling and disrupts the structured Harmony output formats.49 Using the native MXFP4 GGUF variant is the standard for deployment, providing faster prefill speeds and preserving reasoning capabilities.49

### **KV Cache Quantization and Sizing**

Executing large models at high contexts can rapidly exhaust workstation memory.16 To prevent out-of-memory crashes on unified memory APUs, operators can compress the Key-Value (KV) cache.30  
Using 8-bit cache quantization (--cache-type-k q8\_0 and \--cache-type-v q8\_0) reduces memory footprint with almost no loss in logical reasoning.30 Additionally, developers can use 4-bit KV cache quantization formats (such as \--cache-type-k q4\_0 or turbo3) to further reduce memory usage and increase token throughput in memory-constrained environments.9

## **Platform-Level Compiler Patching and Engine Developments**

Running high-performance models on AMD unified hardware requires implementing recent platform fixes and compiler optimizations.4

ROCm LLVM Shared Memory Optimization  
  ├── LLVM Workaround Bypass: Deletes unroll threshold overrides   
  ├── Upstream Pull Request \#21066: Bumps target version to ROCm 7.2.1   
  └── compiler fix: Resolves shared memory loop-unroll bug 

### **LLVM Compiler Loop-Unroll Resolutions**

Workstations utilizing AMD ROCm stacks face critical performance issues under older compiler releases.4 In ROCm 7.2, an LLVM optimization bug incorrectly unrolled memory access loops targeting \_\_shared\_\_ GPU allocations, mistaking them for stack variables (alloca).4 This compiler bug led to register pressure and resource contention, reducing execution speeds for quantized models by 2 to 3 times.4  
This issue is resolved in ROCm 7.2.1 and subsequent nightly releases (integrated in ROCm 7.13.0) by patch ggml-org\#21066.4 The compiler fix prevents incorrect loop unrolling on shared memory blocks, restoring standard hardware-accelerated execution speeds for quantized weights.4

### **llamacpp\_backend.cpp Chunked-Decode Fix**

Executing long-context models in local environments often triggers chunked decoding when inputs exceed the server's processing limit (n\_batch).7 In earlier versions of llama.cpp, a bug in the chunked-decoding logic caused the token counter (n\_cur) to incorrectly tracking input arrays.7  
When the prompt size exceeded 2048 tokens, the system tracking variable (batch.n\_tokens) recorded only the final chunk instead of the total processed array.7 This bug caused newly generated tokens to overwrite existing KV cache entries, resulting in 1-character responses or runtime crashes during deep reasoning steps.7 Build b9247 resolves this bug by forwarding context lengths correctly, stabilizing high-context execution.7

### **Lemonade Backend Updates**

The release of Lemonade v10.3 introduces several platform improvements for local deployment, including unified hardware detection and a consolidated system configuration interface.51

* **OmniRouter Integration:** Lemonade's new OmniRouter unifies text generation, speech recognition, and image synthesis into a single OpenAI-compatible REST endpoint.51 This allows developers to chain local models as tools in an agentic loop without needing external wrapper APIs.51  
* **System Info Consolidation:** The internal system monitoring endpoint has been updated to consolidate AMD hardware types under a single amd\_gpu label.51 This simplifies configuration across diverse systems, including unified APUs and discrete desktop cards.51  
* **Channel Selection:** Lemonade now includes a configuration interface to switch between stable and nightly build tracks.52 This allows developers to easily test experimental features, such as nightly llamacpp-rocm updates, or stick to stable production builds.52

## **Risk Assessment and Deployment Suitability Architecture**

To guide deployment, the target models are evaluated across several operational dimensions: serviceability, template complexity, backend stability risk, and platform lifecycle longevity.1  
This analysis highlights a major transition in enterprise model lifecycles.53 In late 2025, foundation model providers began deprecating older reasoning models, such as IBM's Granite 3.2 8B Instruct, in favor of the larger, open-weights gpt-oss-120b.53 This transition signals a broader shift toward deploying highly capable, reasoning-enabled MoE architectures on workstation-class hardware.13  
The serviceability and risk profiles of these architectures are structured below:

| Model Architecture | Prefill Speed / Generation Speed (gfx1151) | Serviceability Ease | Parser Integration Overhead | Backend Allocation Stability | Lifecycle Viability |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Gemma 4 26B A4B IT (Q6\_K)** | Prefill: ![][image4] 16 Gen: ![][image5] 16 | **High** (Runs comfortably on unified memory) 3 | **Medium** (Native tokens; requires GBNF adjustment for tools) 31 | **Excellent** (Consistent execution on ROCm and Vulkan) 28 | **High** (Perpetual Apache 2.0 open-weights license) 2 |
| **Gemma 4 31B IT (Q6\_K)** | Prefill: ![][image6] 16 Gen: ![][image7] 16 | **Medium** (High processing overhead) 3 | **Medium** (Same token structure as MoE variant) 31 | **High** (Prone to out-of-memory errors on large context allocations) 16 | **High** (Standard Apache 2.0 open-weights model) 2 |
| **gpt-oss 120B (MXFP4\_MOE)** | Prefill: ![][image8] 50 Gen: ![][image9] 50 | **Low** (Demands precise virtual memory tuning) 5 | **High** (Requires strict channel hygiene and multi-stage extraction) 43 | **Critical Risk** (ROCm allocations prone to failures, requiring Vulkan) 25 | **Excellent** (Strong developer adoption; actively integrated into enterprise frameworks) 53 |

### **Structural Model Ranking**

1. **Gemma 4 26B A4B IT Thinking:** This model is the easiest to serve.1 Firing only 4B active parameters per token, it provides fast prompt processing and interactive text generation while remaining well within the APU's memory boundaries.3  
2. **Gemma 4 31B IT Thinking:** While highly capable, this dense model demands significant memory and processing overhead.3 On unified platforms, it struggles with slow generation speeds, requiring quantization to remain practical.16  
3. **OpenAI gpt-oss 120B:** This model presents the highest integration complexity and execution risk.1 Its large 117B parameter footprint can trigger ROCm allocation failures, requiring Vulkan fallbacks or precise virtual memory tuning.17 Additionally, it uses the complex Harmony prompt format, which requires custom client-side parsing to prevent output issues.43

#### **Works cited**

1. research-prompt.md  
2. Running Google's Gemma 4 Locally with llama-server | by VenuThomas \- Medium, accessed May 29, 2026, [https://medium.com/@VenuThomas/running-googles-gemma-4-locally-with-llama-server-5232f122f6c8](https://medium.com/@VenuThomas/running-googles-gemma-4-locally-with-llama-server-5232f122f6c8)  
3. Running Gemma 4 26B MoE on 8GB VRAM: Three Strategies That Work \- Botmonster Tech, accessed May 29, 2026, [https://botmonster.com/ai/gemma-4-26b-moe-8gb-vram-budget-hardware-setup-guide/](https://botmonster.com/ai/gemma-4-26b-moe-8gb-vram-budget-hardware-setup-guide/)  
4. \[Issue\]: ROCm 7+ Performance regression on llama.cpp \#2865 \- GitHub, accessed May 29, 2026, [https://github.com/ROCm/rocm-systems/issues/2865](https://github.com/ROCm/rocm-systems/issues/2865)  
5. Trillion-Parameter LLM on an AMD Ryzen™ AI Max+ Cluster, accessed May 29, 2026, [https://www.amd.com/fr/developer/resources/technical-articles/2026/how-to-run-a-one-trillion-parameter-llm-locally-an-amd.html](https://www.amd.com/fr/developer/resources/technical-articles/2026/how-to-run-a-one-trillion-parameter-llm-locally-an-amd.html)  
6. llama-cpp-pydist \- PyPI, accessed May 29, 2026, [https://pypi.org/project/llama-cpp-pydist/](https://pypi.org/project/llama-cpp-pydist/)  
7. Releases · timmyy123/LLM-Hub \- GitHub, accessed May 29, 2026, [https://github.com/timmyy123/LLM-Hub/releases](https://github.com/timmyy123/LLM-Hub/releases)  
8. Jiunsong/supergemma4-26b-uncensored-gguf-v2 \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/Jiunsong/supergemma4-26b-uncensored-gguf-v2](https://huggingface.co/Jiunsong/supergemma4-26b-uncensored-gguf-v2)  
9. AtomicChat/gemma-4-31B-it-assistant-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/AtomicChat/gemma-4-31B-it-assistant-GGUF](https://huggingface.co/AtomicChat/gemma-4-31B-it-assistant-GGUF)  
10. unsloth/gemma-4-26B-A4B-it-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF](https://huggingface.co/unsloth/gemma-4-26B-A4B-it-GGUF)  
11. bartowski/google\_gemma-4-26B-A4B-it-GGUF · Hugging Face, accessed May 29, 2026, [https://huggingface.co/bartowski/google\_gemma-4-26B-A4B-it-GGUF](https://huggingface.co/bartowski/google_gemma-4-26B-A4B-it-GGUF)  
12. Gemma 4 \- How to Run Locally | Unsloth Documentation, accessed May 29, 2026, [https://unsloth.ai/docs/models/gemma-4](https://unsloth.ai/docs/models/gemma-4)  
13. gpt-oss Inference with llama.cpp \- DebuggerCafe, accessed May 29, 2026, [https://debuggercafe.com/gpt-oss-inference-with-llama-cpp/](https://debuggercafe.com/gpt-oss-inference-with-llama-cpp/)  
14. unsloth/gemma-4-31B-it-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/unsloth/gemma-4-31B-it-GGUF](https://huggingface.co/unsloth/gemma-4-31B-it-GGUF)  
15. google/gemma-4-31B-it \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it)  
16. Gemma 4 31B, 26B, and E4B on AMD Ryzen AI Max+ 395 (Strix Halo) via Vulkan (or ROCm) with Kubernetes (or Docker) \- Akehir, accessed May 29, 2026, [https://akehir.com/blog/strix-halo-kubernetes-llm-gemma-4](https://akehir.com/blog/strix-halo-kubernetes-llm-gemma-4)  
17. unsloth/gpt-oss-120b-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/unsloth/gpt-oss-120b-GGUF](https://huggingface.co/unsloth/gpt-oss-120b-GGUF)  
18. giladgd/gpt-oss-120b-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/giladgd/gpt-oss-120b-GGUF](https://huggingface.co/giladgd/gpt-oss-120b-GGUF)  
19. unsloth/gemma-4-31B-it-GGUF at main \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/tree/main](https://huggingface.co/unsloth/gemma-4-31B-it-GGUF/tree/main)  
20. lmstudio-community/gemma-4-26B-A4B-it-GGUF \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/lmstudio-community/gemma-4-26B-A4B-it-GGUF](https://huggingface.co/lmstudio-community/gemma-4-26B-A4B-it-GGUF)  
21. Quantized Models for google/gemma-4-26B-A4B-it \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/models?other=base\_model:quantized:google/gemma-4-26B-A4B-it](https://huggingface.co/models?other=base_model:quantized:google/gemma-4-26B-A4B-it)  
22. Quantized Models for google/gemma-4-31B-it \- Hugging Face, accessed May 29, 2026, [https://huggingface.co/models?other=base\_model:quantized:google/gemma-4-31B-it](https://huggingface.co/models?other=base_model:quantized:google/gemma-4-31B-it)  
23. bartowski/google\_gemma-4-31B-it-GGUF · Hugging Face, accessed May 29, 2026, [https://huggingface.co/bartowski/google\_gemma-4-31B-it-GGUF](https://huggingface.co/bartowski/google_gemma-4-31B-it-GGUF)  
24. second-state/gpt-oss-120b-GGUF · Hugging Face, accessed May 29, 2026, [https://huggingface.co/second-state/gpt-oss-120b-GGUF](https://huggingface.co/second-state/gpt-oss-120b-GGUF)  
25. GPT-OSS 120B throws OOM under RocM, but works under Vulkan · ggml-org llama.cpp · Discussion \#19483 \- GitHub, accessed May 29, 2026, [https://github.com/ggml-org/llama.cpp/discussions/19483](https://github.com/ggml-org/llama.cpp/discussions/19483)  
26. \~21 tok/s Gemma 4 on a Ryzen mini PC: llama.cpp, Vulkan, and the messy truth about local chat \- DEV Community, accessed May 29, 2026, [https://dev.to/hrodrig/21-toks-gemma-4-on-a-ryzen-mini-pc-llamacpp-vulkan-and-the-messy-truth-about-local-chat-m82](https://dev.to/hrodrig/21-toks-gemma-4-on-a-ryzen-mini-pc-llamacpp-vulkan-and-the-messy-truth-about-local-chat-m82)  
27. Misc. bug: ROCm backend fails to load on Windows 11 (since build b8152) · Issue \#19943 · ggml-org/llama.cpp \- GitHub, accessed May 29, 2026, [https://github.com/ggml-org/llama.cpp/issues/19943](https://github.com/ggml-org/llama.cpp/issues/19943)  
28. llama-bench ROCm 7.2 on Strix Halo (Ryzen AI Max+ 395\) — Qwen 3.5 Model Family, accessed May 29, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1rorzuk/llamabench\_rocm\_72\_on\_strix\_halo\_ryzen\_ai\_max\_395/](https://www.reddit.com/r/LocalLLaMA/comments/1rorzuk/llamabench_rocm_72_on_strix_halo_ryzen_ai_max_395/)  
29. Qwen3.6 27B and llama.cpp appreciation post : r/LocalLLaMA \- Reddit, accessed May 29, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1tjbi24/qwen36\_27b\_and\_llamacpp\_appreciation\_post/](https://www.reddit.com/r/LocalLLaMA/comments/1tjbi24/qwen36_27b_and_llamacpp_appreciation_post/)  
30. gpt-oss: How to Run Guide | Unsloth Documentation, accessed May 29, 2026, [https://unsloth.ai/docs/models/gpt-oss-how-to-run-and-fine-tune](https://unsloth.ai/docs/models/gpt-oss-how-to-run-and-fine-tune)  
31. Gemma 4 Prompt Formatting | Google AI for Developers, accessed May 29, 2026, [https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4)  
32. Multimodal and Agentic Workflows with Gemma 4 in KerasHub, accessed May 29, 2026, [https://keras.io/keras\_hub/guides/gemma4\_multimodal\_and\_agentic\_workflows/](https://keras.io/keras_hub/guides/gemma4_multimodal_and_agentic_workflows/)  
33. Building Gemma 4 Local-Powered LLM Apps with Go and Yzma | by Vladimir Vivien, accessed May 29, 2026, [https://medium.com/@vladimirvivien/building-gemma-4-local-powered-llm-apps-with-go-and-yzma-6bc43d48ee4e](https://medium.com/@vladimirvivien/building-gemma-4-local-powered-llm-apps-with-go-and-yzma-6bc43d48ee4e)  
34. Support for Gemma 4 thinking block recognition · Issue \#10153 · Kilo-Org/kilocode \- GitHub, accessed May 29, 2026, [https://github.com/Kilo-Org/kilocode/issues/10153](https://github.com/Kilo-Org/kilocode/issues/10153)  
35. Thinking mode in Gemma | Google AI for Developers, accessed May 29, 2026, [https://ai.google.dev/gemma/docs/capabilities/thinking](https://ai.google.dev/gemma/docs/capabilities/thinking)  
36. Looking for the right approach for error-free tool calling · ggml-org llama.cpp · Discussion \#21839 \- GitHub, accessed May 29, 2026, [https://github.com/ggml-org/llama.cpp/discussions/21839](https://github.com/ggml-org/llama.cpp/discussions/21839)  
37. How to use tool calling using ChatLlamaCpp and Gemma 4 E4B with create\_agent?, accessed May 29, 2026, [https://forum.langchain.com/t/how-to-use-tool-calling-using-chatllamacpp-and-gemma-4-e4b-with-create-agent/3647](https://forum.langchain.com/t/how-to-use-tool-calling-using-chatllamacpp-and-gemma-4-e4b-with-create-agent/3647)  
38. Configuration | Hermes Agent \- nous research, accessed May 29, 2026, [https://hermes-agent.nousresearch.com/docs/user-guide/configuration](https://hermes-agent.nousresearch.com/docs/user-guide/configuration)  
39. Hermes Agent \+ Gemma 4 & Qwen 3.5: Local AI Agent Guide \- Lushbinary, accessed May 29, 2026, [https://lushbinary.com/blog/hermes-agent-gemma-4-qwen-3-5-local-ai-guide/](https://lushbinary.com/blog/hermes-agent-gemma-4-qwen-3-5-local-ai-guide/)  
40. Open WebUI | Hermes Agent, accessed May 29, 2026, [https://hermes-agent.nousresearch.com/docs/user-guide/messaging/open-webui](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/open-webui)  
41. hermes-agent/website/docs/user-guide/docker.md at main \- GitHub, accessed May 29, 2026, [https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/docker.md](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/docker.md)  
42. Hermes Agent — Docker \- nous research, accessed May 29, 2026, [https://hermes-agent.nousresearch.com/docs/user-guide/docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker)  
43. gpt-oss:120b/template \- Ollama, accessed May 29, 2026, [https://ollama.com/library/gpt-oss:120b/blobs/51468a0fd901](https://ollama.com/library/gpt-oss:120b/blobs/51468a0fd901)  
44. GPT-OSS \- Axolotl Docs, accessed May 29, 2026, [https://docs.axolotl.ai/docs/models/gpt-oss.html](https://docs.axolotl.ai/docs/models/gpt-oss.html)  
45. gpt-oss and grammar \#15341 \- ggml-org llama.cpp \- GitHub, accessed May 29, 2026, [https://github.com/ggml-org/llama.cpp/discussions/15341](https://github.com/ggml-org/llama.cpp/discussions/15341)  
46. Grammar, reasoning and jinja \#12204 \- ggml-org llama.cpp \- GitHub, accessed May 29, 2026, [https://github.com/ggml-org/llama.cpp/discussions/12204](https://github.com/ggml-org/llama.cpp/discussions/12204)  
47. AI Providers | Hermes Agent \- nous research, accessed May 29, 2026, [https://hermes-agent.nousresearch.com/docs/integrations/providers](https://hermes-agent.nousresearch.com/docs/integrations/providers)  
48. Is there any wayto change reasoning effort on the fly for GPT-OSS in llama.cpp? \- Reddit, accessed May 29, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1o9584a/is\_there\_any\_wayto\_change\_reasoning\_effort\_on\_the/](https://www.reddit.com/r/LocalLLaMA/comments/1o9584a/is_there_any_wayto_change_reasoning_effort_on_the/)  
49. Have you tried GPT-OSS-120b MXFP4 with reasoning effort set to high? Out of all, accessed May 29, 2026, [https://news.ycombinator.com/item?id=46972283](https://news.ycombinator.com/item?id=46972283)  
50. My settings for running Gemma 4 31B smoothly on llama.cpp, CUDA 13.1 \- Reddit, accessed May 29, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1sii3q5/my\_settings\_for\_running\_gemma\_4\_31b\_smoothly\_on/](https://www.reddit.com/r/LocalLLaMA/comments/1sii3q5/my_settings_for_running_gemma_4_31b_smoothly_on/)  
51. Lemonade v10.3: Run Local LLMs, Image Gen, and Speech on Your Own GPU for Free, accessed May 29, 2026, [https://dev.to/arshtechpro/lemonade-v103-run-local-llms-image-gen-and-speech-on-your-own-gpu-for-free-29ob](https://dev.to/arshtechpro/lemonade-v103-run-local-llms-image-gen-and-speech-on-your-own-gpu-for-free-29ob)  
52. llama.cpp Backend Options \- Lemonade, accessed May 29, 2026, [https://lemonade-server.ai/guide/configuration/llamacpp.html](https://lemonade-server.ai/guide/configuration/llamacpp.html)  
53. Changing to gpt-oss-120b models \- IBM, accessed May 29, 2026, [https://www.ibm.com/docs/en/masv-and-l/cd?topic=features-changing-gpt-oss-120b-models](https://www.ibm.com/docs/en/masv-and-l/cd?topic=features-changing-gpt-oss-120b-models)  
54. Harmony Response Format sometimes outputted when using gpt-oss-120b as an Agent, accessed May 29, 2026, [https://forum.langchain.com/t/harmony-response-format-sometimes-outputted-when-using-gpt-oss-120b-as-an-agent/2554](https://forum.langchain.com/t/harmony-response-format-sometimes-outputted-when-using-gpt-oss-120b-as-an-agent/2554)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAWCAYAAACrBTAWAAADKElEQVR4Xu2YWaiNURTHl5nIFMrUveQBGcqQFB1DEZLhgfCE4sFUSEnIVHjwIkVebqYkMsucByWzeJAhRJQhiigP4v9v7e/e9S3nnPudB2fQ96tf9+y19zn3O+vbe6/9HZGUlJSUgsnAW/Bb+Ds/3p2VjbDGB3OwFnYz7Sp4xLTJAjjItFvBbXCYiVUsg+FTOEo0EYfhb7jSjPH0gN/hft+RhUain2f9BRfZQeBK6LPug03toErlEhxv2s3gS/gDdjRxy3HRRCVJcmPRG/IQvhOdwfb/RVyF9+EXeAEujXdXLg1Ft4hnsI2J7xadSdm2jXFwlySfyfwfXCn1cRlW++D/AGfZR9GE9jLxHSG2xMQIl/4N0RmeNMkkSZK5oqp9MCHTYQMfNEyETXywmAyEY1zsomiSx7o4i9OK8LqQJHOlcA8+C9/Ak7BTbIQmeS48AR/Ae3B4bERuFsNNPhjg9e6R/Deh6LCo/YTXJX5hreFNqZsRhST5K5wUXrcQXQ1MuOUM3GzaO+Er2N7E8sHVN8/FOHlOi67AsoIV/bXEj1yEx6mppl1Ikvu59kLRlWIL4ADzmvQRHbPFxXPBvf8QnBPaXAVcHZwcZcUs+Fn+TkoVPOdihSTZwz2SCWQBzUVL0TGPfEceWGN4BF0veiRsF+8uPTwv8+g21HeIHrv6uljSJG+FbyVeWDOiCYweSFi43sMZtSN0q+KYDyaWhNGixXyZ7yg13eFzONLEeLHR9sCE8gvn0u+FFp5/OcYW1ykhtj20N4Q2Z2BE2xDj/p2UEfA27AAPwtnx7tLRXPRRmluFZQ2c7GIR/BJMgJ/JLGrLYVcTY0Hys2q16PszoT0NHpD4MYsJ45h1JpYP7sFPYM/QZrHj9ZVFomtEn7JYJK7Bx/CT6BfsXTsqThfRfhYay6oQP2ZinUU/m+8hvEEvRAtsBLeG81L3OwWLGE8bvBbeuPoYIppgX0u4R/O4ONPFiworr1/61my/GxwVvSnRmLuihYxMEH3c9rOPSTglunXcEd0W/LGKN2OvaMHikudNSFq4+J7+PhjgD008jton2pSUlJSUlJR/wR+BD7P8+nlWGwAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAWCAYAAACrBTAWAAADZklEQVR4Xu2YaahNURTHl3me55BMmeehhEyFp5SUZA4pZMpUIhJlikwf8OmZh4wRMpQyJArfZMgrvgghiiTx/1v73Lvveufce31w3711fvXrvb32vuees886a+9zRWJiYmL+mSHwAfzq/s5O7f5LebgGXoHn4EHYJWVEOB3hfVjVdoQwTfT49+Ap2Cq1u3DpA5/DobAFPAF/w+XeGLIeroLlXHsgfA/bJ0aEM1r0eFHOdOPmwyewsWuvhW+9dkFzHY7y2lVgCfwGG7lYDfgxMSLJIbjRBg3zpPTEBr6E1WET+B1OcJ8hfHLewBVerCDhhbBEvIB1vPg+0UkIygazle2uiRHKLrjDxCxb4DgTqwDPS/Lm8nt4/O6JEcoNeNXECo6Koo88L7CdF+fEMbbQtZltP+AHONLF6sJXsLdrR8HHnmN9WHY2ee29ot/X0ouRs6JJkKmej5dkGQtjDKxkg7mkBxxuYtdEL3qEFzvgYr9ESwSzbK7Xny2d4R3RbA7gQspjN/ViJFgf2pq4ZQHcYIOOZXC/pL8JOae1aNZyIvwTY10+Lcl6yhLTy+vPlstwqokFN9VO8lEX72TiYfDpm2ViTJ6LknpD8wIuZq9Fdxo+zEAukpMlWWI+S+k6mo6e8J1omfK5JOGTfMTFM+1gCNeXY3CKaw8QPd/aiRF5wiTRXYRd4LiN4sR3cG3WyKBucw+cLcWiF245LHqsZiZ+3MUbmHgUvHksMevgTVgvtbvs4X65BPazHaL17owNgj3wp2gpyQQngIvYbtsBdopOJkuVD3cgjDNLs2WY6JO22HaUNVzVuWcd7MV4ssHWixm12esL4NscF8JatiOE/qITxp2FZYZon92pcF24a2LpGAQfwoai9ZylLS/go89XaZYKn9VwrPufmXxbSq/Q3H34k1ANLoXNvVjAItGJXGI7RB/rL3C6F6ssumXMNiNZg5/BNq7NxY5lKC8muhh+Eq2Vt+BT0YvjhDBTCWvyI3hSkr8nMDNZ9/zsWyn6ubDSslW0j6/PYfCp4W8WwU5gDnwsmffIpK/oBNu1hCXqApxo4jmFKy8vPEpmUwDfCLeLZj0nlwufXaiKRMsHX0AsLAl8deZvHlHwRWebaAaydtdP7Y6E59PNBh01RcuO/0YbExMTExMT8z/4A54JtkxQQTkeAAAAAElFTkSuQmCC>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFkAAAAWCAYAAACrBTAWAAADG0lEQVR4Xu2YW8hMURTH/665XyKFpEjkFnJJvCCKF6Wk8OSFB/WJEpJ7olDCAym5ExIelFsJEaFQSCgRIrcHJYn/v7XPzD7bOdM0p++bmTq/+te31l6zmr1n77XX/oCcnJycihhDnaKuURed7dOcWu3GzlIHqSGxiHRaUhtgue9T26i2sYhs+euC2dQHapyzl1JvqRaFCGA9tZJq5uwJ1CdqQCEinePUEdhit6HOwxbcJ0v+mqcn9YNa4fluU3+pPs5uT30pDhc4RG0KnQEzYbl6eL7Bzhf9qFny1wVbYRPu5fmmU2s9W7tJMUM9n9hJ7Qh8ITr2HwOfdvQfapWzs+SvC57DjmUp2lG/qM/UNOfrQr2iRkVBKTyinoZO8pW65P7Okl/MQrHMJDGDahU6mwpNRDvoCTWXug4rFaqN4ZfaB4vVDtQRvkItikUk8w220CG6A156dqX5xWJqY+h0LKP2ovSP0Kj0h01ME94DO8adqXvUAS9OqG6ehsVLL6iRsYhkFJu0yO9gl2tEpfkjVFYWBL7J1AXEL/AmRzUw2j3dPH+D84/wfLqsLsN2vMqLxrVLh3sxSfxE8iJrgV97dqX5I9QCHqPmOXs8LF+nQkSV0GWnyaj2+eiLyr/Z2eoM3lADna02TDtHMXecLw197nHoJO9hPbPIkt9HJ/EE7NK+SnWND1eH1kieyBznVwkRqndnisMFdlG/YUc9jQewox/yHbbTRJb8IZNgJ0GnsWbQIjwMfPMR38l6TGwpDhcYBCs1HcMBj/2wTsJH3YTyRzmz5PeZCLtPulNHYaWnJlAnoceI300sgS3CFGdrp93A/ze0xm95tp7Kei329nxTYbn6ej49QuSL2rNy85dCNVjtaD9n67I7jBpZaC2MWrh1sEmqrdNu0FGNJq2aqR1/EsXFGgure34fuxy2eOHR1/8q/EeFJq+2KqLc/GmMhi1w+JhRjT4HK39VRy8uHa9nsAsoqZ6ptdtO3YVNXoumJ7mPXoo63msCv27+hdRuWPnQjyGfTzn501D8sNDp6EDdhOXPycnJycnJaUz+AZ7Kwah8NcjGAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAAAWCAYAAAAvrxV9AAAF70lEQVR4Xu2Zd6hdRRDGRxONvcRgQ41GxV6wIIpijF2saMA/1BdLVFQsYGyoiAr2gthbYlTsXbEXYokialRUbBjsolhRQRCd35vde+fMPfvefUngvsD54OOd/Xbv2Z05s7uz+0QaNGjQoEGD+QXjlGdF0WMB5RpRdDhY+aTyNeW9yrHV6n6sqLxF+aLyDeXkanU/RirPVb6gfEt5qXLRSoveYDD7RylPERv3s8qLlSMqLYav/RuJfXz6OjHUdYtTlftHEays3FfMKQ+FuoxjlLOUy6fy2crvXRmMUb4n1hasqvxUeU5ukHCX8g4xRy6ifFTMmd3gsCjMA3Rj/5JiY5wuFjTYjW1HuzbD2f5NxSb9f8qbQ123eF1svBUcL2b01cp/pN6BKyj/Vk502oLKr5RTnHaZ2Ls8cPBPyoVSeR8xI3zgrZ+0rZxWB/r8MopziW7sB6w22MEqBPYUG/MNrRbzh/0/ypwF0ObKqVGM+FPqHXi4mIEbB/055VOuPFt5jyuDCWK/3S6Vb1P+0K7uBzPxX+UZQY/YRfldFOchSvaPFptA1zptcbGg29Bps2X42/+tzFkAXaTcLYoRJQfiKJzAkuzxoPIPsWWNvT/OSEDkop+ZyszQj9rVLfyifCaKDmwhb8rcO3AglOzvE7OB1aqE+cV+do2hBhC5IeOO+V4HSg5Ewwk4yePupK+p3CI9E2weJG/oefn7VTqXeUA+9XkUE9YVe0ckCa0HK+WrypfFEn2S/qGgZD9bE/0dqXxEOUN5v5jNGcPB/m2VTyhniuUrF4itbh4+gMin/PtOz40CxiuvChpB1YGSA5kZdBAD6M6kr6fcPj1HB+b9naQR8FznwG+UX0cxgOSzNANxFqee5VJ5FeVnypNbLQZHyX4+PuP+WMxWcIjyd2lvYb22f2+xus1SmVztcbEE3cMH0FJiNtwuNs7aoFBcLxacHuNDuR8lBzKQugDCKehrK7dOz9GBOBydvR/8JfUOxHlfRDGg5EByM/qIR0xOQ/S3VtBLKNlPv7z/cqfhbBLS+1K5l/aTQpBcXxl0gpu++5xGAE0TS+qnKs9zdXWg3btRVFwRBYADH46iWIQykJWCnh3LrF8nPV9TadE2IneIoe+3q1vAMdyJDISSA1l96IOt1GOHpHd771Gyn+SZ98Qj9IdiJ7clpLf27y714+PUhv6A0wig6WKTn/GXVp0MrjfOj6JUg7KFkgOJbAYSL9loi85Ax6RnLtE8tkx6vsF8W+xuJOI3sXuYgVByYM7F4vjyqnBd0Eso2c8s5T17BZ2VBJ2J1Uv7jxXrY1LQASveB65MAHHw4d6pLugiCLRNoij2zTuAA0kSI4g2Osv7a8YrYklrxidSjXaQZ8ceqcz+y4nDYzGxNhcGPSI68Pn0l62F3/sjNdgp6YMt0xkl+9kaec8BQec0hc6RHvTK/v3Efp8vMDMWTvpLTiOAOD0Dvh3H+mXb1RVwO07A14F7sA7gwJh0ATog2SJxzGBwXJCd4DSWOhJNvyxOETM6X6TtLGbU2FYLu0CrC9AIttJ8h0IfT6dnEjx+PzGVM45K+jZBL6FkPx+Yj36a0+gf+/0Ncq/sX1rsFBdPSjn/8qcrAibnSpwcuX8iSa7DgVK+m+q4ChgldllGVNfti+yFHI1HpPJk5TtSvdrmmaimLSCCmZUHtVoY+H+MT0hxTLw/qQPHVhwyTuxSzTuM982S9mpAws/4bm21GBiD2X+oWJKb78ImiSW+HNMzemk/q+TPyg1SmQlO4s42ywQAI8WC/qZUBrThnTs6LYPVlL7q0AqgCWJ3BjiPF0HuI9iPSQ49GPQlYgYz+NHV6n6gMVOnKW8UW14j2D9ZHTixMBAcU7unBnCZNlNstjHmeCo8TixJpY6Zxswb7L1DsZ9cgzoClfrVK7WGXtrPlk2CTh1tCJS8Pe0qNvZsI+9ZTWxlzZr/rwJ9zXDliHjabNCggj7lSVFs0KBbPCbVf/g2aNA12PYG+r9cgwYDgruhI6LYoEG34OJ1mShG/A8LwuTIDUSW+wAAAABJRU5ErkJggg==>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAWCAYAAACffPEKAAADLklEQVR4Xu2XWahNYRTHl1kyZkyGSOYHlAdRPEgZIw+ScEOERCmhlGR8MlN4uFKmyDzHlXkWkqFQXlCiFPIg/n/r2/ess+7e5+x7j6d77r9+ne9b69v72/u/1/6+fURqVKNi014fyKc24DPo5hNOq0CpD/5nNQErwGqw0+XSahDY5IP5tB38AT19wqgL+A72+USCZvhASjUHm8E38Nrl0morGOyDuTQQ/JL8JhwDvyWdCbXBex+spA5L1UyoAx74YD5dB1tETejhcpFGiFZL2krg+A8+WEntl6qZMBqs9cFcmgTWgCWSXAl09jZoLelM4Dt9Xwo3gfNUxQQuiP18MEkNwE3QSHKbMBssDu18JvB4nsfD81sNAWdEzb0D1oG6WSOyTeCCbc93Lhrk1BA8drFaYC44IXq/t2xyqWQWryQTmoK7oF7o5zMh0gFJroRxorkBoc+HcRqcLB+h8pVQJnotXPCi6/GaApa52DBwz/S7Rw2WNl2hS1SSCRvAeNMv1AQ+KS6YfvvqKzr/dBPjPG9De5bo02fV5tIp0MHFNoIrUrHSZBcYavpxJnQGZ02fKtSEkaLz+O2TuwnjR02M87wDc0Kuo8nFqZXozXrRWB7/SrTiFjHYHxw0g6g4E7hF9TZ9qlAT5ovOU+Li1A/w3PQ5z09wQ3TeUpOLE81a4IOiBi8XPT/nJuU3nERUgpzY5yz+aVp5Ey6H3wmix84zOap+iF81MZrAV6cxWB/yXFCTdEn0y9drDGgZ2qymf5UQJ76jnMSvCVYsN45JUwkc8ym0ue5cCO1m4KPod4lVL9Fz20WN3wmPQpvb7hvwRNQwr7bgvA8G7QFTfTBOO0Qvoo9PGLUXHcOLy6eo2rqKfjjZm54IvkhmLt4U9/ankr3wcUt7IVrO1EzRc66MBhgtFM3HiSbw3HyIVIWdZazovhqVOC/uUNYI1RHwVTLjHoJRWSOyxSfHbwA+dX4HtMtOy3DwLOQ4ZjdoEXIcyy0tmuul6B+iaybGRa5TGE+VSeZ4r22iJh0HF6XiYl8txPec/2uKWnz1JvtgsYmvCT/Cilb8T5Fmt6rWmib617lS+gvK89LqqbIiEAAAAABJRU5ErkJggg==>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAWCAYAAADU1CLnAAAEiUlEQVR4Xu2Yech1UxSHlzFjRMYMGTNlnkMZo0SSZPxEKMk8Fz5DhpJkyKdkCCH+QoTM8zzPw1dmKVNRkvg9d+39fvtd79n7Xu+9ef1xn/rV3Wufu8/aZ5299trHbMyYMWP+Lxwk7RGNka2ke6THpYdSe6ZZSlomGhMLShea+/uadIW06KQrRs/e0rnSHGn30DcoD0jLR2PJAdJ30japfYr0lbTAxBXdLGn+31Eyn7SOdLT0vrkvXdwp3W4elEWk+8wD049hfN5Pek76W5oV+gZhZenBaCxZSfpVOquwvWB+w1ULWxc7mT+UUXK39Kx0m7kPXcHY17yvfMM2SLb8QtUY1udNbPrBOFk6MhpLLjcfnKhl9pLOL9o1LrbhJtZiW6sH41bp+2BjhfwlnRPskWF93tCmH4ynpSWiseQj6YdoHID1pd9suIm1aAXjbemDaBQ/SY9EY8EofF7PpheMNaV7o7FkafOB35UOlp4yT1FnSwsV10WOMf9fFA8ws7B0kfS69IT0mLRl0d+PVjB+Ng9IhH3vs2hMDOIzHGW+LzwjPS8dNrl7SjBuSe2sHZI9wsYf96plpdnSozTWMh+ASVxnvtSpYF6Rbvbrm3xr3W8ZgXxSutHmFQG7SL9IO6Z2P1rBwN4VjK/NC48WNZ/hUukl84cEq0ifSqdNXDE1GLtKf0pnWrtK4plSaJQQIKrAHhuZD0yuzQ7Aicm+aWHrojax48z/v0Kwcy3ppbXqMq1g/G7dwSAQc6MxUPN5Y/P77R/szIX7rZ3aORhsxMyPfYA9tgVFxU3RaF6Ss4f1YNNm4M8nup1Dkv2SYI/UJkY11JUuzjMfd/PY0UEOxqmxQ3whvRON5v4wwRY1n1kV3I9sUbJzsp+U2jkYp5un9xuSvcWV1n3QI3MwFquxl9dpvFheIQ5MdlJXi9rESHufRKP5UmZc9qd+tILBPtQ1Pmmwl38b1Hy+y/x+awT7dsl+fWrnYFAssCr+SLYanJvesu4zG1tCLuF7MLE3JrqdQ+3frwwe3mXp96upL8KJmXEHOb3mYJT5OsMbxcMoWcz8+uxDjZrPvL38n9RdsluyU4xADgYrhTTFGe3h1NcFK+vqaEzMigYqJwYs8zg34oZsTi1IFxzSgI2ZNASMyf+XS+0MJ+YfzVdkP3IwSAcRgknf6oWNvIytXwqs+UwVxP9jxXNssm+f2vmckfeWE1Kb1N4F2aVWtHwsrVYa+J5D7pttvqQod9n5r0ntFvebf7IgkGxEeSKLm5fJ5aZFWUuNf0Rha5Fz9QWxI0EVwtucYbkPkr9rPgPjvWnuP6xonjXKeWxt7tfhqT2/+f4416Z+sSA1UWjUniPBYJVOSmF8C7pD+tD8zaGaGoTNzMtJnOFtw7EM34Cukr40T4VUUXzb6Qer8j3zCo9JI9LenPIi83vx1l5rnrbOSLZ+tHyG482fAfvoN+arPF/DPTjj4BN7BT7tmdqIqqt8eejjC0cN0hsrq3VQHTMieEm2iMYx/z2kwZejcczMsI/NKw7GzDB8WV43GsfMDLl8Hoh/AO3tKV8Lmse5AAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAWCAYAAACffPEKAAADqklEQVR4Xu2XWYiOURjHH7tk35Ula0SIXAgZSyRLJBeSJUtC4gKFyIVQyl4UF2OXsu/rTMLYsia7KS4QUYRc8f/Pc873nfeZ9x0zH1cz86t/33v+57zve85z3vOc84mUU05ZY6c14ugP3YK+ud9p0eoUE6Ez0HXoINQqWv3fqQUtg1ZCW01dcekNbbCmpSf0HMqCmkMHoN/QgqANmQ3dhxq78nLofVAuiqnWKCZ1oY3QV9E+ZsJmqI81LRegoUG5GpQP/YAaOa8J9BMa5xuBitBbaGHgxcF2b6xZQvjVZRKEStAda1rYQS6BF1CdwN8m+jX4ZcFflrumWigXobPGswyB3lmzhOyTzIIwHFplTUtl6KPoANsF/jrnzXXlLa7cItVCOSwaxOrG93BN35Z/D8JuySwITIjdrRlHN2ig8c6LDnqQKx9x5aapForPH22NTzqK1lktChuBvtApKA+6Aa0WnZyQMAicrPB5TNRxcGLuGa8CNAs6Bl0TTfCxtIZ+QVdFbyI+KDYIe53fyfgh+yX5SxglWtfDlZmPTkLHUy0U+yXkQDdFE16VwA+ZAC02Xpbo7ufpEFxH2CWayLhTeNixuCDscX5744ckBYEzxffY7auL6DMnBx6D8NpdTxed/Rrp6lhOSHQMZD10WQp/aRHGQ59FOxLCTrBjzYzPAdJvYPyQpCAME73Xbp9M1vQPBR7fnw/NdHU2N1kaig7WwsDy/meiEzs/Wq3nBb6ol60QnS3ezKUSctT57HgSSUGYI3rvFOMTbs+PgzKDwC2aS/Q7lB3UxcFg+aQewn4uEX0+302lYGRfQv0CbwA02l37CPq162GnmGCKwgbhkvsdI/pMHsJCqjo/N/AYBC6dmtAaV8+EmgTPPnGHuBGS/mo55tSXwLXJZMGlELIUGumu64me2ialqws6+wmaF3hxcAAf3DUT7Tl3zXMJT5ybXNnDJMtBhkmN54S77prb7ivogWgfLDzYJZ1ddoge/QuRDX0RjV4u9ER0cOwItzkPvwpuKTyFkRmiW1DSGcHDLZHPaiN6cAoHPVY0B3V2ZQ6Ke/tDiSY+bmnsl192/vC2wjcI4KT4Q56FQeCzmTNIwc5SW9JrI0420hzEWtHZ5WDqR6tj4czlic46zwF2hxkMPXJ1bLNd9MsjbMuv1PfnqegfoiuBxyTX0rUnOZK+38JDH4PEXMZt/3S0unTAdc6DXZmGS8/mtjIHl8nfclSphv8pmKvKNNy++de5RPwBOjHakXggMhEAAAAASUVORK5CYII=>