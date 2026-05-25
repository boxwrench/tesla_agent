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

## 📊 Headline Performance Statistics
Benchmarks run on the AMD Ryzen Strix Halo APU (128 GB system memory, 96 GB allocated VRAM pool):

| Benchmark Category | Scored Performance Metrics | Status / Target |
|---|---|---|
| **Planning Quality** | **82 / 84** (Scorecard Rubric) | Clear, rigorous structure; one minor regulatory-date miss |
| **Tool Execution** | **3 / 3 Passed** (Nonce Gate Validation) | Reliable autonomous tool calling; no code printing |
| **Coding Reliability** | **3 / 3 E2E Passed** (State-carrying 4-step Grader) | Messy CSV telemetry QA & hex decoding |
| **Inference Speed** | **44.2 tok/s** (ROCm) / **52.1 tok/s** (Vulkan RADV) | High-speed Mixture-of-Experts (MoE) generation |
| **Memory Footprint** | **21.7 GB** loaded weight profile | Fits in Strix Halo GTT pool with 32k context |

---

## 1. Core Objectives
* **100% Data Privacy:** Run models completely offline. Your sensor logs, SCADA telemetry, and lab results never leave your building.
* **Plug-and-Play Setup:** Built specifically for the **AMD Strix Halo (gfx1151)** Unified Memory Architecture.
* **Teach-by-Building:** Designed for water operators with little to no machine learning experience.

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
│   └── 09-building-your-workflow.md # Transition to real-world utility work
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
