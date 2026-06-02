# Chapter 09: Building Your Workflow

Now that you have a functioning local agentic AI setup and know how to verify its accuracy, you can build custom workflows for your utility operations. 

This chapter covers the agent loop, managing model memory, and adapting the evaluation framework for your specific plant.

---

## 1. Inside the Agent Loop

When you run a command like `qwen36_mxfp4 -t "Check sensor data"`, the Hermes agent engine executes a continuous execution loop:

```
                  ┌──────────────────────────────┐
                  │    User Goal is Received     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────┐
│               THINK (Reasoning Trace)                  │
│       Agent plans steps: "I need to read log.csv"       │
└──────────────────────────────┬─────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────┐
│                        ACT                             │
│     Agent issues command: "cat /root/input/log.csv"    │
└──────────────────────────────┬─────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────┐
│                      EXECUTE                           │
│        Terminal execution runs command in VM           │
└──────────────────────────────┬─────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────┐
│                       OBSERVE                          │
│     Result stdout is returned to agent memory          │
└──────────────────────────────┬─────────────────────────┘
                               │
                               ▼
     (Loop repeats until goal is achieved or max turns reached)
```

By understanding this loop, you can design better tools. The agent behaves best when tools output clean text (like CSV or JSON) that can be easily parsed.

---

## 2. Adapting the Evaluation Framework

The coding evaluation is a powerful blueprint. You can adapt it to test your operators or automate your plant checks by replacing the **fixtures** and updating the **grading rules**:

1. **Replace the Fixtures:**
   Put your own data files inside `eval/coding/fixtures/`:
   * Swap `scada_raw.csv` with a dump from your actual plant's flow transmitters.
   * Swap `lab_results.json` with your weekly bacteriological lab sheets.
   * Swap `mcl_limits.json` with your state primacy agency's maximum contaminant levels.
2. **Update the Grader:**
   Open `eval/coding/grade.py` and adjust the checking parameters. For example, change the turbidity limit from `0.3 NTU` to your plant's specific limit (e.g. `0.15 NTU` for membrane filters), and update the expected exceedance lists.

---

## 3. Managing Long Conversations (Context Size)

Running multi-step workflows generates a lot of text, which consumes your **Context Window**.
* **The limit:** The Qwen 3.6 35B model supports up to a **32,768 token context window** in graphics memory.
* **Hermes Context Compression:** To prevent sessions from exceeding this limit, the Hermes framework uses a compression model. When context usage exceeds 50%, it automatically summarizes older conversation turns, preserving vital system prompts while freeing up graphics memory.
* **Best Practice:** Keep your tool outputs clean. If a script needs to query a database of 10,000 rows, do **not** print all 10,000 rows to the console. Instead, write Python helper code to filter the data first and print only the matching rows. This keeps context usage low.

---

## 4. The Path Forward

Local agentic AI is evolving rapidly. Here are the developments that could enhance your workflow:

### **A. Lucebox MoE Support**
For Qwen 3.6 35B, the current opt-in speed path is **MTP self-speculative decoding** with the Qwen3.6-35B-A3B-MTP GGUFs and `--spec-type draft-mtp`. On the reference box this lifts the workhorse from ~58.5 tok/s to ~72.7 tok/s on MXFP4-MTP, or ~81.2 tok/s on Q4_K_M-MTP after separate quality gating.

### **B. Official Driver Support**
As AMD continues to update the ROCm driver stack, consumer APUs like Strix Halo may receive native, out-of-the-box support, removing the need for GFX override variables in `set_hsa_env.sh`.

### **C. Custom Tool Integrations**
You can write custom Python scripts that connect your local agent directly to your plant's database APIs, allowing you to ask questions like: *"Is my chlorine dose tracking correctly with flow today?"* and have the agent verify operations in real-time.
