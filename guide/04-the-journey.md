# Chapter 04: The Journey — What We Tried and Learned

When you begin building a local AI setup, it is easy to assume that following a standard online tutorial will lead directly to a working system. In reality, the path is often filled with compatibility bugs, outdated libraries, and software mismatches.

This chapter documents the development journey of this project—what was tried, why it failed, and the hard-won lessons learned along the way.

---

## 1. The Core Problem: Tool Calling Failure

We started with a powerful Strix Halo chip and a model that could converse intelligently. However, the model could not **use tools**. When asked to read a log file, instead of formatting a structured command to execute, it would simply output text like:

```text
To read the log file, I will run the command: cat /root/input/server_logs.txt
```

Because it printed the command as plain text rather than executing it, the agent loop stalled. The model was just a chatbot; it was not an agent.

---

## 2. Attempt 1: vLLM + Parser Hacks (ROCm backend)
* **Hypothesis:** Using a popular serving framework called `vLLM` on ROCm would provide fast text generation and support tool-calling.
* **The Test:** We followed a community recipe designed for NVIDIA cards.
* **The Result:** The server took **25 minutes** to compile its GPU kernels on startup (warming up). Once running, requests from the agent timed out.
* **The Lesson:** *NVIDIA recipes do not automatically translate to AMD chips.* Complex, compiler-heavy frameworks can introduce massive startup latency and driver bugs on unified APUs.

---

## 3. Attempt 2: Custom Inference Engines (Lucebox MoE loading error)
* **Hypothesis:** Mixture-of-Experts (MoE) models would run faster and smarter. We tried loading a new Qwen MoE model into a specialized engine called Lucebox.
* **The Test:** Load the model and initialize the server.
* **The Result:** The server crashed immediately on launch:
  ```text
  target load: unexpected arch: qwen35moe
  ```
  The engine did not yet support the specific architecture of the new MoE model.
* **The Lesson:** *Check the cheapest thing first.* Before spending hours tuning a model, verify if the inference server engine can actually open the model file.

---

## 4. Attempt 3: The Accidental Discovery (Lemonade & Stock llama.cpp)
* **Hypothesis:** We installed a suite called Lemonade to try its custom vLLM loader.
* **The Test:** Start the model through Lemonade.
* **The Result:** The vLLM loader failed, but Lemonade also shipped a copy of the stock, lightweight `llama-server` binary. Out of curiosity, we ran the Qwen MoE model directly using this stock binary.
  * It loaded in **2 seconds** (not 25 minutes).
  * It successfully parsed the model's structure.
  * Running our verification tests reported a perfect **3/3 pass rate** on tool calling.
* **The Lesson:** *Sometimes the simplest tool is the winner.* The stock, dependency-free `llama-server` from the llama.cpp project worked perfectly where heavy, complex custom frameworks failed.

---

## 5. What We Learned About Speed

Once the server was working, we ran extensive benchmarks to optimize speed. We uncovered two critical insights:

### Insight A: Vulkan is Faster than ROCm on Strix Halo
We compiled `llama.cpp` using the **Vulkan** backend instead of AMD's official ROCm platform. 
* Vulkan achieved a **+13% to +19% speedup** in text decoding on 35B models.
* The Vulkan backend runs via the open-source **Mesa RADV** driver, proving that community drivers can outperform vendor computing libraries for local consumer APUs.

### Insight B: Match the Speedup to the Architecture
We attempted to speed up generation using "speculative decoding" (such as MTP or DFlash), which uses a tiny model to guess words and a large model to verify them.
* On **Mixture-of-Experts (MoE)** models, speculative decoding was actually **slower** than normal generation. *Why:* verifying guesses forces the large model to reactivate and route different experts constantly, adding a routing penalty that wipes out the gains.
* On **dense** models the opposite is true. The dense 27B has no expert router, so DFlash speculative decoding lifts the route to **~31 tok/s (2.82×)**. (A surprise on this hardware: the *smaller* draft model wins — a fatter draft starves the shared memory bus it shares with the model it's helping.) *We benchmarked the dense 27B thoroughly but did **not** keep it in the stack: in practice it was neither faster nor clearly smarter than the 35B MoE workhorse. It stays on the shelf as a "try something different" option for tough, stuck problems — an arrow in the quiver, not a daily driver.*

### The Other Lever: Reasoning Budgets (mind the exception)
A second adjustment is the **Reasoning Budget** (the `thinking_budget_tokens` flag): capping how many tokens the model spends "thinking" (e.g. 256–512) roughly halves response time on **planning and prose** work. **One important exception:** on stateful **coding** tasks, capping the budget made the model drop carried-forward details and fail the multi-step gate — there, leave thinking uncapped. Speed is cheap; a wrong answer fast is not a bargain.

### The 2026-05-30 Ladder Pivot
Later benchmarks added two important model families to the stack.

* **gpt-oss-120B became the general QUALITY baseline.** After the draft-with-assumptions system prompt fixed its checklist-deflection behavior, it won blinded pairwise tests 5-1 vs Qwen 35B and 4-2 vs Qwen 122B, while decoding around 46 tok/s on Vulkan/RADV.
* **Gemma 4 31B became the cross-family coding experiment.** It cleared nonce and orchestrated coding gates, then beat Gemma 26B-A4B 4-2 on the quality battery. **Important caveat:** Gemma 31B is a dense model — verified decode is ~8.25 tok/s (tg128), far slower than the MoE models in the stack. It earns its place for quality verification and cross-family comparison, not for throughput.
* **Qwen stayed in the stack, but with narrower roles.** Qwen 3.6 35B remains the CODE/general baseline, and Qwen 122B is retained as a QUALITY spot-specialist for regulatory-currency and sharp plan-review tasks.

This is not a claim that Qwen is "bad." Online consensus still treats Qwen as a strong reasoning family, and the local Qwen routes remain useful. The change is narrower: on this Strix Halo hardware, with these agentic utility workflows, the latest local gates added gpt-oss-120B as the general quality baseline and Gemma 4 31B as a cross-family coding experiment. For throughput, Qwen 3.6 35B MoE (~50 tok/s Vulkan) and gpt-oss-120B (~46 tok/s Vulkan) remain the speed leaders; Gemma 31B runs at ~8 tok/s on this hardware and is used on the orchestrated path where quality matters more than wall-clock time.

In the next chapter, we will build this exact, simplified stack step-by-step.
