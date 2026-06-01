# tesla_agent // Local Agentic AI for Utilities

> [!IMPORTANT]
> **Explore the Interactive Guide & Dashboard Live at:**  
> 👉 **[boxwrench.github.io/tesla_agent](https://boxwrench.github.io/tesla_agent/)**

Welcome to **tesla_agent**! This repository is a clean-room, plug-and-play template designed to teach **water treatment operators and utility professionals** how to build and run local, private agentic AI workflows on consumer AMD hardware.

This is the guide we wish we had when we started: verbose, explanatory, data-driven, and honest about what didn't work.

For related writing on utility work, technology, and practical operations, see **[Title 22](https://www.title22.org/)** — *water, systems, strategy*.

---

## ⚠️ Legal Disclaimer & Warning

> [!CAUTION]
> **CRITICAL INFRASTRUCTURE WARNING:** This repository and its associated scripts, guides, and models are educational resources and research prototypes only. They are **NOT** certified, approved, or designed for use in real-time control, automated process adjustment, regulatory reporting, or direct operations of public drinking water systems, wastewater treatment facilities, municipal SCADA systems, or any other critical infrastructure.
> 
> The code, data, and models are provided **"AS IS"** without warranties of any kind, express or implied. Under no circumstances shall the authors or copyright holders be liable for any operational failures, water quality compliance violations, health hazards, equipment damage, or legal penalties resulting from the use of this software.

---

## 🛑 Before You Start: The Apprentice Has the SCADA Keys

> [!WARNING]
> An agent with high-level permissions is three things at once: **an apprentice you've handed the SCADA console, a five-year-old with your phone, and a junior staffer with the corporate credit card.** Confident, eager, and unsupervised, it *will* do something you didn't intend.
>
> Before you give an agent write access to *anything* that matters, read **[Chapter 11 — Agent Safety](guide/11-agent-safety.md)**. It covers sandboxing, least-privilege access, credential isolation, spend limits, kill switches, and the incident playbook for when (not if) something goes sideways.
>
> The single most important control for cloud agents is a **hard spend cap set on the provider side, today, before the first run** — it's the difference between a $5 lesson and a $1,000 hole when an agent loops on a failing task overnight. (Every model in this repo runs locally specifically so this failure mode does not exist.)
>
> The cheapest hour you'll ever spend on this stack is the one you spend reading the safety chapter before you let an agent run unattended for the first time.

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
| 11 | [Agent Safety](guide/11-agent-safety.md) | Sandboxing, least privilege, spend limits, kill switches — read before write access |

> Prefer a rendered, interactive version? See the [live site](https://boxwrench.github.io/tesla_agent/). For technical lookups, jump to the [Reference](reference/README.md).

---

## 🛠️ Reference Testing Stack
All benchmarks were run on local consumer hardware with the following configuration:
* **Hardware (APU):** AMD Ryzen Strix Halo (gfx1151), 128 GB LPDDR5X system RAM (configured via modprobe with **96 GB GTT graphics memory pool**).
* **Server Backend:** `llama.cpp/llama-server` (stable build `b9247`) served via ROCm 7.2.x (HIP) and Mesa/RADV Vulkan (Mesa 25.2.8). The fastest current lanes use the **Vulkan/RADV** backend (see matrix).
* **Parameters:** Greedy decoding (temperature = 0), context buffers scaled from 8,192 to 32,768, Flash Attention active.

## 📊 Model Performance Matrix
Below are the actual measured results across the different configurations. *Community consensus still rates Qwen models highly for reasoning, and Qwen remains available in this stack. The recommendations below follow the local Strix Halo agent-workflow gates and pairwise results measured for this repository.*

> [!WARNING]
> **Correction (2026-05-31):** An earlier version of this table listed Gemma 4 31B IT Q6_K at "43-48 tok/s" — that number was misattributed and belonged to gpt-oss-120B Vulkan quality runs. The corrected Gemma 31B figure is below. Gemma 31B is a **dense** model; it reads the full weight set each token, making it memory-bound slow on this APU. MoE models (Qwen 35B, 122B, gpt-oss) route fewer active parameters per token and are correspondingly faster.

| Model & Quantization | RAM Footprint | Context Window | Think Toggle | Planning Quality (Scorecard) | Generation Speed (Decode) | Nonce Gate (Tool Use) | Verdict / Fit |
|---|---|---|---|---|---|---|---|
| **gpt-oss-120B (MXFP4, 3 shards)** | **~63 GB** | 32,768 | High reasoning | **Pairwise: 5-1 vs Qwen 35B; 4-2 vs Qwen 122B** | **~46 tok/s** (Vulkan) | **3 / 3 Pass** | **QUALITY baseline (general)** |
| **Gemma 4 31B IT (Q6_K)** | **25.2 GB** | 32,768 | On for coding | Pairwise: **4-2 vs Gemma 26B-A4B** | **~8.25 tok/s tg128; ~7.7 tok/s sustained** (Vulkan; pp8192 ~133.6 tok/s) | **3 / 3 Pass** | **Second-opinion lane (dense — slow decode); use orchestrated path** |
| **Qwen 3.6 35B MoE (Vulkan RADV)** | **21.7 GB** | 32,768 | **On** | **82 / 84** | **50.1 tok/s** (Vulkan) | **3 / 3 Pass** | **CODE/general baseline** |
| **Qwen 3.6 35B MoE (ROCm)** | **21.7 GB** | 32,768 | **On** | **82 / 84** | **44.2 tok/s** (ROCm) | **3 / 3 Pass** | ROCm fallback backend |
| **Qwen 3.6 35B MoE (ROCm)** | **21.7 GB** | 32,768 | **Off** | **82 / 84** | **43.7 tok/s** | **3 / 3 Pass** | Cuts wall-time in half for prose (falls to 1/3 coding E2E) |
| **Qwen 3.5 122B MoE (MXFP4)** | **70.0 GB** | 12,288 | **On** | **80 / 84** | **19.4 tok/s** (ROCm) | **3 / 3 Pass** | **QUALITY spot-specialist: regulatory currency and sharp plan review** |
| **Qwen 3.5 122B MoE (MXFP4)** | **70.0 GB** | 12,288 | **Off** | **81 / 84** | **19.5 tok/s** | **3 / 3 Pass** | Holds 3/3 coding even think-off |
| **Gemma 4 26B-A4B IT (UD-Q6_K_XL)** | **21.2 GB** | 32,768 | Off in tested gate | Pairwise: 2-4 vs Gemma 31B | **40.11 tok/s** mean *(not independently verified in public repo; do not treat as confirmed)* | **3 / 3 Pass** | **Queued candidate only; coding gate cleared, not Stable Stack** |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** | **16.4 GB** | 32,768 | **On** | 0-6 vs Qwen 122B | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in the stack (see note)* |
| **Qwen 3.6 27B Dense (UD-Q4_K_XL)** | **16.4 GB** | 32,768 | **Off** | — | **9.6-11.5 tok/s** tested normal decode | **3 / 3 Pass** | *Experimental — not in the stack* |
| **Qwen3-Coder-Next (UD-Q4_K_XL)** | **49.6 GB** | 16,384 | **On** | — | **34.6 tok/s** (ROCm) | **3 / 3 Pass** | 128GB Coder Challenger |

> [!NOTE]
> **The dense Qwen 3.6 27B is benchmarked but NOT in the production stack** — community discussion often treats it as a strong reasoner, but the local Strix Halo gates did not corroborate that for this workflow. A blind quality pairwise put it 0-6 against the 122B on the standard prompt set, and tested backends remained around 9.6-11.5 tok/s for normal decode. It remains a break-glass *"arrow in the quiver"* for tough, blocked projects where trying a different dense trace might help, **not a first- or second-line choice.**
>
> *Technical aside (why it's interesting even though unshipped):* DFlash speculative decoding lifts the dense route to **~31 tok/s (2.82×)** with a footprint-minimized Q4_K_M draft — the inverse of the MoE result below, because a dense model has no expert router to thrash during draft verification.

> [!NOTE]
> **Why is Gemma 4 31B so much slower than Qwen 35B MoE?** Both are ~25 GB models, but they have very different internal architectures. Qwen 3.6 35B is a Mixture-of-Experts model that activates only ~3B parameters per token — so each decode step reads far less weight data from memory. Gemma 4 31B is a **dense** model: every one of its 31B parameters must be read for every token generated. On a memory-bandwidth-bound APU like Strix Halo, this difference dominates, producing ~8 tok/s for the dense Gemma vs ~50 tok/s for the MoE Qwen on the same hardware.

> [!TIP]
> For full reproducibility data, model checksums, evaluation methodologies, and detailed post-mortems of failed attempts (such as vLLM compilation timeouts and MoE speculative decoding latency overhead), see the [Reproducibility Matrix & Deep-Dive](reference/reproducibility-matrix.md).
>
> For the long-form research that informed these recommendations — Strix Halo backend tradeoffs, MoE integration architecture, prompt-architecture patterns — see the [Research](research/README.md) folder.

---

## 🧪 Does It Actually Work on Real Plant Data?

The benchmarks above measure the *model*. A separate, ongoing evaluation measures the **whole agent** doing real operational work: given a plain operator question and a pointer to data, can the local stack read the data itself, write and run its own analysis, and reach a sound, operator-facing conclusion — **entirely on the local machine, with nothing leaving the box?**

We test it against the public **SWaT** water-treatment dataset across three different kinds of problem:

* **Pump short-cycling** — *event detection* (a duty-cycle fault)
* **Membrane fouling** — *trend fitting* (a slow pressure-rise trend on real, cyclically-cleaned data)
* **pH / acid-dosing control** — *control-loop tracking* (is the controlled variable holding its band against its actuator?)

**The short answer: it basically works — as a supervised assistant, with caveats.** The local agent (Qwen 3.6 35B-A3B MoE) reliably runs the full loop to completion, reproduces hand-computed ground-truth numbers to several significant figures on clean data, and writes clear operator briefs. Fully local is verified per run, not assumed.

The most interesting finding is one we didn't expect: **on real, messy data the agent repeatedly out-reasoned our hand-built answer key.** On the membrane data it discovered the clean-in-place cycles on its own and analyzed the steady trend between them — a more correct method than our first ground truth. On the pH data it caught a 3-minute acid-pump dropout that crashed pH to 6.0, flagged it as a water-quality event, and **disagreed with our rubric — which a domain expert then confirmed the agent had gotten right.** Four times the evaluation ended up auditing *us*, not the model.

It is not an unsupervised operator. The honest caveats — a single yes/no verdict on a borderline case can flip between runs; most results are one MoE model; real-data windows are still short — are documented alongside the wins, because the goal here is to help people *learn to work with a new tool*, not to sell one. Chapter [04 — The Journey](guide/04-the-journey.md) and [11 — Agent Safety](guide/11-agent-safety.md) carry that same "what failed and why" spirit.

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
│   ├── 10-orchestrating-agents.md # One agent vs pipelines, batch, orchestrators
│   └── 11-agent-safety.md         # SAFETY: sandboxing, spend limits, kill switches
│
├── reference/                     # TECHNICAL REFERENCE (Quick lookups)
│   ├── README.md                  # Pinned versions, checksums, benchmarks
│   ├── glossary.md                # Plain-language glossary of ML terms
│   ├── architecture-diagram.md    # Mermaid stack diagram
│   └── decision-tree.md           # Mermaid model chooser flowchart
│
├── research/                      # DEEP RESEARCH ARTIFACTS (Long-form)
│   ├── README.md                  # Index, reading order, who-this-is-for
│   ├── strategic-architecture-frontier-moe-strix-halo.md
│   ├── cognitive-dual-stack-engineering-local-workflows.md
│   ├── high-performance-orchestration-reasoning-architectures.md
│   ├── american-stack-research-synthesis.md
│   ├── american-stack-research-synthesis-round2.md
│   ├── strix-halo-agentic-evaluation-report.md
│   └── infrastructure-profiling-framework.md
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
