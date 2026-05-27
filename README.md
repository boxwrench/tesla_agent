# tesla_agent // Local Agentic AI for Utilities

> [!IMPORTANT]
> **Explore the Interactive Guide & Dashboard Live at:**  
> 👉 **[boxwrench.github.io/tesla_agent](https://boxwrench.github.io/tesla_agent/)**

Welcome to **tesla_agent**! This repository is a clean-room, plug-and-play template designed to teach **water treatment operators and utility professionals** how to build and run local, private agentic AI workflows on consumer AMD hardware.

This is the guide we wish we had when we started: verbose, explanatory, data-driven, and honest about what didn't work.

---

## ⚠️ Legal Disclaimer & Warning

> [!CAUTION]
> **CRITICAL INFRASTRUCTURE WARNING:** This repository and its associated scripts, guides, and models are educational resources and research prototypes only. They are **NOT** certified, approved, or designed for use in real-time control, automated process adjustment, regulatory reporting, or direct operations of public drinking water systems, wastewater treatment facilities, municipal SCADA systems, or any other critical infrastructure.
> 
> The code, data, and models are provided **"AS IS"** without warranties of any kind, express or implied. Under no circumstances shall the authors or copyright holders be liable for any operational failures, water quality compliance violations, health hazards, equipment damage, or legal penalties resulting from the use of this software.

---

## 📖 The Guide

Start here and read in order — each chapter builds on the last. Written for water-treatment and utility professionals new to AI, not just engineers.

| # | Chapter | What it covers |
|---|---|---|
| 01 | [What is Agentic AI?](guide/01-what-is-agentic-ai.md) | Core concepts — agents, tools, the tool-call loop |
| 02 | [Why Local?](guide/02-why-local.md) | Privacy, offline capability, and cost |
| 03 | [The Hardware](guide/03-the-hardware.md) | Strix Halo, unified memory, and GTT pools |
| 04 | [The Journey](guide/04-the-journey.md) | What failed, what worked, and why |
| 05 | [Setup](guide/05-setup.md) | Step-by-step build with troubleshooting |
| 06 | [Verification](guide/06-verification.md) | Running the Nonce Gate and Coding Eval |
| 07 | [Choosing a Model](guide/07-choosing-a-model.md) | Benchmarks and reasoning toggles |
| 08 | [Speed and Tuning](guide/08-speed-and-tuning.md) | Vulkan vs ROCm, reasoning budgets |
| 09 | [Building Your Workflow](guide/09-building-your-workflow.md) | Putting it to work on real utility tasks |
| 10 | [How Agents Work Together](guide/10-orchestrating-agents.md) | One agent vs pipelines, batch, and orchestrators |

> Prefer a rendered, interactive version? See the [live site](https://boxwrench.github.io/tesla_agent/). For technical lookups, jump to the [Reference](reference/README.md).

---

## 🛠️ Reference Testing Stack
All benchmarks were run on local consumer hardware with the following configuration:
* **Hardware (APU):** AMD Ryzen Strix Halo (gfx1151), 128 GB LPDDR5X system RAM (configured via modprobe with **96 GB GTT graphics memory pool**).
* **Server Backend:** `llama.cpp/llama-server` (stable build `b9247`) served via ROCm 7.2.x (HIP) and Mesa/RADV Vulkan (Mesa 25.2.8). The 35B `CODE` workhorse is now served on the **Vulkan/RADV** backend (see matrix).
* **Parameters:** Greedy decoding (temperature = 0), context buffers scaled from 8,192 to 32,768, Flash Attention active.

## 📊 Model Performance Matrix
Below are the actual measured results across the different configurations. *Variations in reasoning toggles and graphics backends represent major speed/latency differences:*

| Model & Quantization | RAM Footprint | Context Window | Think Toggle | Planning Quality (Scorecard) | Generation Speed (Decode) | Nonce Gate (Tool Use) | Verdict / Fit |
|---|---|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE (Vulkan RADV)** | **21.7 GB** | 32,768 | **On** | **82 / 84** | **50.1 tok/s** (Vulkan) | **3 / 3 Pass** | **Recommended Default (CODE workhorse)** |
| **Qwen 3.6 35B MoE (ROCm)** | **21.7 GB** | 32,768 | **On** | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | ROCm fallback backend |
| **Qwen 3.6 35B MoE (ROCm)** | **21.7 GB** | 32,768 | **Off** | **82 / 84** | **43.7 tok/s** | **3 / 3 Pass** | Cuts wall-time in half for prose (falls to 1/3 coding E2E) |
| **Qwen 3.5 122B MoE (MXFP4)** | **70.0 GB** | 12,288 | **On** | **80 / 84** | **19.4 tok/s** (ROCm) | **3 / 3 Pass** | **Quality Escalation** |
| **Qwen 3.5 122B MoE (MXFP4)** | **70.0 GB** | 12,288 | **Off** | **81 / 84** | **19.5 tok/s** | **3 / 3 Pass** | Holds 3/3 coding even think-off |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** | **16.4 GB** | 32,768 | **On** | — | **~7.0 tok/s** (ROCm) | **3 / 3 Pass** | *Experimental — not in the stack (see note)* |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** | **16.4 GB** | 32,768 | **Off** | — | **~7.0 tok/s** | **3 / 3 Pass** | *Experimental — not in the stack* |
| **Qwen3-Coder-Next (UD-Q4_K_XL)** | **49.6 GB** | 16,384 | **On** | — | **34.6 tok/s** (ROCm) | **3 / 3 Pass** | 128GB Coder Challenger |

> [!NOTE]
> **The dense 27B is benchmarked but NOT in the production stack** — it is a break-glass *"arrow in the quiver"* for tough, blocked projects where trying a different (dense, single-trace) model might help, **not a first- or second-line choice.** A blind quality pairwise put it 0–6 against the 122B (largely on output-discipline leakage, but it showed no reasoning *upgrade* over the 35B/122B on substance either), and it is slower than the 35B workhorse. The 35B MoE (workhorse) + 122B MoE (escalation) span the production ladder.
>
> *Technical aside (why it's interesting even though unshipped):* DFlash speculative decoding lifts its ~7 tok/s floor to **~31 tok/s (2.82×)** with a footprint-minimized Q4_K_M draft — the inverse of the MoE result below, because a dense model has no expert router to thrash during draft verification.

> [!TIP]
> For full reproducibility data, model checksums, evaluation methodologies, and detailed post-mortems of failed attempts (such as vLLM compilation timeouts and MoE speculative decoding latency overhead), see the [Reproducibility Matrix & Deep-Dive](reference/reproducibility-matrix.md).

---

## 1. Core Objectives
* **100% Data Privacy:** Run models completely offline. Your local logs, documents, and sensitive data files never leave your workstation.
* **Plug-and-Play Setup:** Built specifically for the **AMD Strix Halo (gfx1151)** Unified Memory Architecture.
* **Teach-by-Building:** Designed for learners and professionals with little to no machine learning experience.

---

## 2. Directory Structure

```text
tesla_agent/
│
├── README.md                      # Front door: what, who, and reading order
├── LICENSE                        # CC BY-NC 4.0 (Attribution Required, Non-Commercial)
│
├── guide/                         # THE TEACHING GUIDE (Read in order)
│   ├── 01-what-is-agentic-ai.md   # Core concepts (agents, tool use)
│   ├── 02-why-local.md            # Privacy, offline capability, and costs
│   ├── 03-the-hardware.md         # Strix Halo, UMA, and GTT pools
│   ├── 04-the-journey.md          # History: what failed and what worked
│   ├── 05-setup.md                # Step-by-step setup with troubleshooting
│   ├── 06-verification.md        # Running the Nonce Gate and Coding Eval
│   ├── 07-choosing-a-model.md     # Benchmarks and reasoning toggles
│   ├── 08-speed-and-tuning.md     # Going faster: Vulkan vs ROCm, budgets
│   ├── 09-building-your-workflow.md # Transition to real-world utility work
│   └── 10-orchestrating-agents.md # One agent vs pipelines, batch, orchestrators
│
├── reference/                     # TECHNICAL REFERENCE (Quick lookups)
│   ├── README.md                  # Pinned versions, checksums, benchmarks
│   ├── glossary.md                # Plain-language glossary of ML terms
│   ├── architecture-diagram.md    # Mermaid stack diagram
│   └── decision-tree.md           # Mermaid model chooser flowchart
│
├── eval/                          # THE EVALUATION FRAMEWORK
│   ├── README.md                  # Explanation of the testing approach
│   ├── coding/                    # 4-step sequential coding evaluation
│   └── quality/                   # 7-dimension planning quality rubric
│
└── scripts/                       # PORTABLE SYSTEM UTILITIES
    ├── config.env.example         # Template configuration file
    ├── setup/                     # Host configuration scripts
    ├── serving/                   # Model server launchers
    └── eval/                      # Validation test runners
```

---

## 3. Quickstart Workflow

To get started, follow the guide chapters in order, or execute these quick setup commands:

1. **Host Diagnostic:** Check compatibilities:
   ```bash
   bash scripts/setup/check_host.sh
   ```
2. **VRAM Pool Allocation:** Allocate graphics memory (requires sudo & reboot):
   ```bash
   sudo bash scripts/setup/apply_gtt.sh
   ```
3. **Environment Setup:** Export driver overrides (source this in every new window):
   ```bash
   source scripts/setup/set_hsa_env.sh
   ```
4. **Launch Inference Server:** Configure environment files and start:
   ```bash
   cp scripts/config.env.example scripts/config.env
   # Edit scripts/config.env to match your path folders
   bash scripts/serving/serve_rocm.sh
   ```
5. **Run Nonce Gate Verification:** Prove tool calling is working:
   ```bash
   bash scripts/eval/nonce_gate.sh
   ```

---

## 4. Interactive Web Dashboard
This repository includes a gorgeous interactive guide and log verifier dashboard. You can access it in two ways:
* **Online:** Visit the live deployment at [boxwrench.github.io/tesla_agent](https://boxwrench.github.io/tesla_agent/)
* **Offline/Local:** Simply open the [docs/index.html](docs/index.html) file in any web browser.

Use the dashboard to select recommended models, follow interactive setup steps with troubleshooting assistance, and paste log outputs to test them against the Nonce Gate verifier.

---

## 5. Security & Data Sovereignty
Public utilities handle critical infrastructure. Sending SCADA readings or operating logs to public cloud APIs violates standard security policies. Running this stack locally protects your data sovereignty, ensuring zero network data leaks.
