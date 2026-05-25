# Glossary

This glossary defines the machine learning, system driver, and hardware terms used throughout the `tesla_agent` guide in plain language.

---

### **Agent (Agentic AI)**
An AI system that does not simply generate a single text response to a prompt, but is given access to **tools** (like reading files, executing shell commands, or query databases) and executes a loops to solve a complex goal.
* *Analogy:* A standard chatbot is like an advisor you call on the phone for answers. An agent is like a digital assistant you give access to your computer, saying "verify these logs and write a report."

### **Unified Memory Architecture (UMA)**
A hardware design where the CPU (main processor) and the GPU (graphics processor) share the exact same physical system RAM. This is common in APUs like the AMD Ryzen Strix Halo.
* *Why it matters:* Traditional gaming graphics cards are limited by their dedicated onboard VRAM (typically 8 GB to 24 GB). Unified memory allows an APU to use up to 96 GB of system RAM as graphics memory, enabling the execution of huge AI models at a fraction of the cost.

### **Graphics Translation Table (GTT)**
A portion of system RAM allocated by the operating system kernel for the GPU to use. In Linux, GTT size must be manually adjusted at boot to allow large local LLMs to load.
* *Why it matters:* If system RAM is 128 GB, but the GTT limit is left at its default (often 32 GB), a 70 GB model will fail to load or will spill to the CPU, grinding generation speed to a halt.

### **Mixture-of-Experts (MoE)**
An LLM architecture where only a subset of neural network layers ("experts") are active for any given token (word). The routing of which expert to use is handled dynamically.
* *Why it matters:* An MoE model might have 35 billion total parameters (giving it high reasoning quality) but only activate 3 billion parameters per token. This allows it to run at the speed of a tiny 3B model while retaining the intelligence of a 35B model.

### **Nonce Gate**
A verification test used to prove that an agent is successfully running tools in its sandbox rather than fabricating ("hallucinating") answers.
* *How it works:* The test harness writes a random secret string (a "nonce") to a file, then asks the model to read and report it. If the model echoes the exact nonce, it has successfully executed the tool.

### **Quantization**
A compression technique that reduces the precision of a model's weights (e.g. from 16-bit floats to 4-bit integers or MXFP4 formats) to shrink its file size and memory footprint.
* *Why it matters:* Quantization shrinks a 70 GB model down to 21 GB, allowing it to fit in graphics memory with negligible loss in reasoning quality.

### **Context Window (Context Size)**
The total amount of text (both prompts and generated answers) that a model can "remember" during a single conversation session. Measured in tokens.
* *Why it matters:* Multi-step agent loops generate thousands of tokens as they inspect files and write scripts. A model with a small context window (e.g., 2,048 tokens) will quickly "forget" previous steps, leading to failures. The Qwen 3.6 MoE supports up to 32,768 tokens.

### **Flash Attention**
An optimized algorithm that accelerates the attention layer calculations in LLMs and reduces memory consumption. Essential for maintaining speed in long context sessions.

### **ROCm (Radeon Open Compute)**
AMD's software platform for GPU-accelerated computing, equivalent to NVIDIA's CUDA. It compiles libraries and runtimes to let AI models run on AMD graphics chips.

### **Vulkan & Mesa RADV**
An open-source, cross-platform graphics library (Vulkan) and driver (RADV) developed by the Mesa project. On AMD APUs, serving models via Vulkan can yield a +15% speedup over ROCm for Mixture-of-Experts decoding.
