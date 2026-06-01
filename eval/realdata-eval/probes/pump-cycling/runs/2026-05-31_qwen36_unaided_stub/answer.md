77.9%). The pump was toggling on and off relentlessly while the level sat flat at ~77.5%. Normal level swings are ~35 percentage points per cycle; during this period the swing per toggle was only ~1.7 percentage points — effectively zero.

This is classic short-cycling behavior. The pump was unable to change the level because the inflow and outflow rates had nearly equalized at that tank level, or the control logic was hunting between setpoints without hysteresis. Either way, the pump was doing ~5× its normal number of starts and stopping in a 4-hour window, which is hard on the motor and drives.

--

3. WHAT THIS MEANS

a) Pump health: Short-cycling is abusive to pump motors. Each start draws 5–7× rated current. Running ~180 starts in 4 hours is a lot of thermal stress. Check the motor windings and drive for overheating or fault logs around that Jan 5 window.

b) Control logic: The normal behavior looks like simple high-low level control — turn on at ~45%, turn
