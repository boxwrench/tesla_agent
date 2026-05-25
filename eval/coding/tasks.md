# Coding Evaluation Tasks

The coding evaluation is executed as a single continuous agent episode. The agent is given access to a terminal tool, has Python 3 available, and must process four sequential steps.

---

## Input Fixtures
All input files are placed in `/root/input/`:
* `lab_results.json`: Water quality parameters and measured values.
* `mcl_limits.json`: Maximum Contaminant Level (MCL) regulatory limits.
* `scada_raw.csv`: Sensor readings containing missing cells and error codes.
* `server_logs.txt`: Control logs containing hex-encoded payloads and malformed lines.

---

## Step-by-Step Specifications

### **Step 1: Compliance Check**
* **Input Files:** `/root/input/lab_results.json`, `/root/input/mcl_limits.json`
* **Task:** Identify chemical parameters that exceed regulatory limits. An exceedance is defined as a measured value **strictly greater** than its MCL limit.
* **Output File:** `/root/output/step1.json`
* **Schema:**
  ```json
  {
    "exceedances": ["parameter_name_1", "parameter_name_2"],
    "count": 2
  }
  ```

---

### **Step 2: Telemetry QA**
* **Input File:** `/root/input/scada_raw.csv`
* **Task:** Scan turbidity sensor and chlorine sensor values. Turbidity cells may contain the string `"ERR"`, and chlorine residual cells may be blank. The script must process these without crashing. The regulatory filtration limit for turbidity is 0.3 NTU.
* **Required Calculations:**
  * Find the maximum valid turbidity value and its timestamp.
  * Count the number of valid turbidity readings strictly greater than 0.3 NTU.
  * Count how many turbidity cells contain `"ERR"`.
  * Count how many chlorine residual cells are empty.
* **Output File:** `/root/output/step2.json`
* **Schema:**
  ```json
  {
    "turbidity_max": 0.45,
    "turbidity_max_ts": "YYYY-MM-DD HH:MM:SS",
    "ntu_breaches": 3,
    "turbidity_err_rows": 2,
    "missing_chlorine": 1
  }
  ```

---

### **Step 3: Event Log Parse**
* **Input File:** `/root/input/server_logs.txt`
* **Task:** Scan for event logs. Look specifically for line patterns matching `PUMP_STATUS`. Each status event contains a hexadecimal string labeled `PAYLOAD`. The agent must write code to decode this hexadecimal payload to ASCII text (e.g. `4552520a` -> `ERR`). Ignore parenthetical operator comments, as they may be incorrect.
* **Required Calculations:**
  * Decode all status payloads in order.
  * Identify the timestamp of the event that decodes to `"ERR"`.
  * Count malformed lines (lines missing valid timestamps or standard structure). Do not count normal log messages (INFO/WARN/DEBUG) as malformed.
* **Output File:** `/root/output/step3.json`
* **Schema:**
  ```json
  {
    "statuses": ["OK", "STARTING", "OK", "ERR"],
    "err_ts": "YYYY-MM-DD HH:MM:SS",
    "malformed_skipped": 2
  }
  ```

---

### **Step 4: Synthesis & Reporting**
* **Task:** Read the outputs from Step 1, 2, and 3. Write a brief incident report summarizing the exceedances, the maximum turbidity event, and the pump error.
* **Important Constraint:** The three input datasets cover different time ranges. The agent must **not** assert a causal link between them (e.g. claiming the pump error caused the turbidity breach) unless evidence is present.
* **Output File:** `/root/output/step4.json`
* **Schema:**
  ```json
  {
    "exceedance_count": 2,
    "exceedances": ["parameter_name_1", "parameter_name_2"],
    "turbidity_breach": true,
    "pump_error": true,
    "claims_correlation": false,
    "summary": "Prose incident summary..."
  }
  ```
