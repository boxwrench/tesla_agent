Based on the analysis of the historian data for P-101 and LIT-101, here is the operational summary.

### Summary: Concern Regarding Pump Control
**The pump is not running consistently.** While the pump is physically operating and moving water, the control logic (the "setpoints" that tell the pump when to start) appears to be unstable or shifting.

### Key Findings
1. **Inconsistent Start Levels:**
   - Normally, a pump should start at a consistent "Low" level.
   - In this data, P-101 is starting at two very different levels: some starts happen around **45**, while others happen as high as **78**.
   - This suggests the pump is either missing its start trigger or the setpoint is changing unexpectedly.

2. **Consistent Stop Levels:**
   - The pump consistently shuts off around **79-80**, which indicates the "High" stop setpoint is working correctly.

3. **Cycle Health:**
   - **No "Short Cycling":** Every run lasted at least 90 seconds, so there isn't an immediate risk of motor burnout from rapid on/off switching.
   - **Total Activity:** Over the 11 days, the pump started 314 times, spending roughly 55% of its time running.

### Technical Breakdown for Audit
* **Start Levels:** min about 43.9, max about 78.1.
* **Stop Levels:** min about 76.9, max about 81.2.
* **Runtimes:** Average run is about 28 minutes.

### Recommendation
Check the level controller settings for LIT-101, especially Auto/Manual flips, a floating or drifting start setpoint, and possible LIT-101 signal issues.
