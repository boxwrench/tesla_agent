# Chapter 06: Verification — Nonce Gate & Coding Eval

Setting up the server is only half the battle. We must verify that the model can successfully control tools, carry state, and parse datasets.

We do this using two verification tests: **The Nonce Gate** and **The Coding Evaluation**.

---

## 1. The Nonce Gate Check

The Nonce Gate proves that your agent is actually executing terminal commands rather than pretending to do so.

### **How it works:**
1. The test harness writes a random, unique key (e.g. `1779630594-8263`) to a file on your disk.
2. It asks the agent: *"Read this file and tell me the exact value."*
3. The agent is forced to use its terminal tool to run a file-read command (like `cat`).
4. To pass, the run must satisfy three strict rules:
   * **Rule 1 (Tool-Use):** The agent must trigger a structured tool call.
   * **Rule 2 (Fidelity):** The response must echo the exact random nonce.
   * **Rule 3 (No Text-Code):** The response must **not** contain markdown code blocks (e.g., ```bash cat file.txt```). The model must *run* the tool, not print it as text.

```bash
# Run the 3-cycle nonce gate check
bash scripts/eval/nonce_gate.sh --verbose
```

### **What success looks like:**
The output should report `PASS` across three test runs:
```text
--- Run 1/3 (nonce: 1779724852-3921-2831) ---
  [PASS] Structured tool call marker
  [PASS] Nonce echoed in response
  [PASS] No markdown shell block
  => Run 1: PASS

Nonce Gate Verification Results: 3/3 Passed
```

### **What to do if it fails:**
* **Error: `FAIL — no structured tool-call marker`**
  The model printed the answer but did not execute a tool call. Ensure your server was started with flash attention active and is utilizing the correct model profile config.
* **Error: `FAIL — fenced shell block present`**
  The model wrote ```bash cat ...``` in its text response. This means it is "chatting" rather than acting. Retest with thinking mode enabled, which guides the model to reason through actions.

---

## 2. The 4-Step Coding Evaluation

The Coding Evaluation runs the agent through a sequential, state-carrying data analysis task that simulates real utility operations.

```bash
# Execute the automated coding battery and collect outputs
bash scripts/eval/run_coding_eval.sh run_test1
```

### **The Sequence of Steps:**
1. **Compliance Check (Step 1):** The agent reads chemical parameters in `lab_results.json` and compares them against MCL rules in `mcl_limits.json`, saving the violations.
2. **Telemetry QA (Step 2):** The agent reads a sensor CSV file (`scada_raw.csv`), filters out cells containing the string `"ERR"`, handles blank chlorine records without crashing, and calculates maximum turbidity.
3. **Log Parsing (Step 3):** The agent scans hex-encoded server logs, writes Python code to decode the hex payloads to ASCII text, and identifies the timestamp of the event that reports `"ERR"`.
4. **Synthesis (Step 4):** The agent reads all three previous output files and drafts a concise summary. It must **not** claim a causal link between the events, as they occur at different times.

### **What success looks like:**
The grading script runs automatically at the end of the evaluation:
```text
step1: PASS
step2: PASS
step3: PASS
step4_structured: PASS
summary_fidelity: PASS
step4: PASS
e2e: PASS
```

### **What to do if it fails:**
* **Error: `collected 0 step file(s) / no step*.json produced`**
  The agent failed to write the outputs to the required folder. Check `eval/coding/results/run_test1/transcript.txt` to see if the script execution crashed inside the Docker container due to a path mismatch.
* **Error: `summary_fidelity: FAIL`**
  The agent successfully wrote the JSON files, but its text summary asserted that the pump error caused the turbidity breach. This violates the correlation rules. Re-run the test to ensure the model uses its reasoning trace to check timelines.

---

## 3. Sandbox Path Validation

Hermes executes commands inside an isolated Docker container to protect your host system. It maps directories between your host and the sandbox container:

* **Host path:** `~/.hermes/profiles/<profile>/sandboxes/docker/default/home/`
* **Container path:** `/root/`

When you stage files or run scripts:
* The host-side files must go in the sandbox `home/input/` folder.
* The model inside the container will look for them under `/root/input/`.
* The model must write its step outputs to `/root/output/`.
* You collect the outputs on the host side from the sandbox `home/output/` folder.

If the agent reports that files are missing, verify that this directory mapping is correctly configured in your Docker runtime.
