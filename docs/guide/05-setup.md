# Chapter 05: Step-by-Step Setup

This chapter walks you through setting up your AMD Strix Halo host to run local agentic AI. Because unified memory allocations and GPU version overrides can easily break, **every step includes failure-recovery guidelines**.

Please open a terminal and follow these steps in order.

---

## Step 1: Verify Host Compatibility

First, check if your system meets the hardware requirements and has access to the graphics driver.

```bash
# Check if your user is part of the required graphics groups
groups

# Run the project host validation check
bash scripts/setup/check_host.sh
```

### **What just happened?**
The script verifies that your kernel detects the AMD APU as the `gfx1151` architecture and checks whether your user account has permission to read the GPU control queues (which requires membership in the `render` and `video` groups).

### **What success looks like:**
The output should report `PASS` on Visibility and Kernel checks:
```text
[PASS] ROCm GPU Architecture: gfx1151 visible to ROCm (Radeon APU)
Check complete: 5 passing, 0 failing, 0 warnings.
```

### **What to do if it fails:**
* **Error: `rocminfo not found` or `gfx1151 is not listed`**
  Ensure the open-source AMD driver is installed. Run `dmesg | grep amdgpu` to verify the graphics driver loaded on boot.
* **Error: Permission denied / groups missing**
  Your user needs access to raw GPU queues. Run:
  `sudo usermod -aG render,video $USER`
  Then **log out of your Linux session and log back in** to apply the group memberships.

---

## Step 2: Override GPU Memory Allocation (GTT Size)

By default, Linux limits graphics allocations to 25%-50% of your total RAM. To run large models, we must modify the Graphics Translation Table (GTT) parameters to allocate up to 75% of your RAM.

```bash
# Apply GTT configurations (requires sudo/root)
# This will detect your RAM and configure GTT size (e.g. 96 GB on 128 GB setups)
sudo bash scripts/setup/apply_gtt.sh

# A reboot is mandatory to apply these kernel overrides
sudo reboot
```

### **What just happened?**
The script creates `/etc/modprobe.d/amdgpu_llm_optimized.conf` and writes kernel module options. It sets `no_system_mem_limit=1` (critical: prevents the GPU driver from silently spilling active computation layers back to the slow CPU) and configures the TTM pages limits. It then updates your system's `initramfs` boot image.

### **What success looks like:**
After rebooting, check that the GTT module parameter reads the custom allocation (in MB):
```bash
cat /sys/module/amdgpu/parameters/gttsize
# For a 128 GB system, this must print: 98304
```

### **What to do if it fails:**
* **Error: `apply_gtt.sh: Permission denied`**
  You must execute this script with `sudo` or as root, as it modifies system files under `/etc/modprobe.d/`.
* **Error: GTT size did not change after reboot**
  If the value remains at its default, your system may use a custom boot loader (like `systemd-boot` or `rrefind`) that ignores `modprobe` configuration files. You must manually add `amdgpu.gttsize=98304` to your kernel command line in your bootloader config (e.g., `/boot/loader/entries/`).

---

## Step 3: Configure Driver Environment Variables

ROCm does not support the Strix Halo gfx1151 chip automatically. You must load override environment variables in your active terminal.

```bash
# Source the variables (run this in every new terminal session)
source scripts/setup/set_hsa_env.sh
```

### **What just happened?**
This exports parameters to your current shell. `HSA_OVERRIDE_GFX_VERSION=11.5.1` fools the driver into treating the APU as a compatible discrete GPU. `HSA_ENABLE_SDMA=0` disables system DMA, preventing kernel lockups during large memory routing.

### **What success looks like:**
```text
GPU Environment Configured:
  HSA_OVERRIDE_GFX_VERSION = 11.5.1
  HSA_ENABLE_SDMA          = 0
```

### **What to do if it fails:**
* **Error: `bash: scripts/setup/set_hsa_env.sh: No such file or directory`**
  Make sure you are running the command from the root of the `tesla_agent` directory.
* **Warning: Command works in one terminal but fails in another**
  Environment variables are terminal-specific. If you open a new window, you **must** run `source scripts/setup/set_hsa_env.sh` again before executing model commands.

---

## Step 4: Build the Vulkan llama-server

We serve on the open-source **Vulkan (RADV)** backend — the fastest lane on Strix Halo and the default for this stack. There is no prebuilt binary for this hardware, so you compile `llama-server` once from source at the pinned stable tag (`b9247`). It takes a few minutes and you only do it once. (A ROCm path is kept as an optional fallback; see [Chapter 08 — Speed and Tuning](08-speed-and-tuning.md).)

**4a. Install the build tools (one time).** These commands are for Ubuntu/Debian — they install the compiler, CMake, and the Vulkan/RADV driver and headers.

```bash
sudo apt update
sudo apt install -y git cmake build-essential \
  libvulkan-dev glslc vulkan-tools mesa-vulkan-drivers
```

**4b. Clone and build.** This clones into `~/src/llama.cpp` and builds the server target using all your CPU cores.

```bash
# Clone llama.cpp into a predictable location and pin the stable tag
mkdir -p ~/src && cd ~/src
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
git checkout b9247

# Build only the server target, with Vulkan (RADV) enabled
cmake -B build-vulkan -DGGML_VULKAN=ON
cmake --build build-vulkan --config Release --target llama-server -j"$(nproc)"
```

**4c. Point the config at your new binary.** Run these from the `tesla_agent` repo folder. The first line creates your config; the second writes the binary path into it automatically.

```bash
cp scripts/config.env.example scripts/config.env
sed -i "s|^TESLA_VULKAN_SERVER=.*|TESLA_VULKAN_SERVER=\"$HOME/src/llama.cpp/build-vulkan/bin/llama-server\"|" scripts/config.env
```

### **What just happened?**
CMake compiled a Vulkan-enabled `llama-server` at `~/src/llama.cpp/build-vulkan/bin/llama-server`. The `sed` line set `TESLA_VULKAN_SERVER` in `scripts/config.env` to that exact path, so the serve script in Step 6 knows where to find it. Prefer to edit by hand? Open `scripts/config.env` and set `TESLA_VULKAN_SERVER` to that path yourself.

### **What success looks like:**
```bash
ls -l ~/src/llama.cpp/build-vulkan/bin/llama-server
# -rwxr-xr-x ... llama-server   (present and executable)

grep TESLA_VULKAN_SERVER scripts/config.env
# TESLA_VULKAN_SERVER="/home/you/src/llama.cpp/build-vulkan/bin/llama-server"
```

### **What to do if it fails:**
* **Error: shader compilation fails / `glslc` too old**
  The Vulkan build needs a current `glslc` shader compiler. The distro `glslc` (2023.x) can be too old; install a newer `shaderc` (or build it from source) and re-run the two `cmake` commands.
* **Error: `cmake: command not found` or missing Vulkan headers**
  Re-run step 4a; the `libvulkan-dev` and `mesa-vulkan-drivers` packages must be installed for the Vulkan build to find its headers and driver.

---

## Step 5: Download the Model

We download the recommended Qwen 3.6 35B MoE model quantized in the space-efficient MXFP4 format.

```bash
# Create models directory
mkdir -p ~/models/qwen3.6-35b-a3b

# Download the model from the verified Hugging Face repository
huggingface-cli download unsloth/Qwen3.6-35B-A3B-GGUF \
  Qwen3.6-35B-A3B-MXFP4_MOE.gguf \
  --local-dir ~/models/qwen3.6-35b-a3b
```

### **What just happened?**
The Hugging Face client downloads the 21.7 GB model file directly to your drive.

### **What success looks like:**
```bash
ls -lh ~/models/qwen3.6-35b-a3b/Qwen3.6-35B-A3B-MXFP4_MOE.gguf
# Outputs a file of size: ~22 GB
```

### **What to do if it fails:**
* **Error: `Disk quota exceeded` or `No space left on device`**
  This model file requires ~22 GB. Ensure your drive has at least 25 GB of free space.
* **Error: Connection breaks mid-download**
  Re-run the `huggingface-cli download` command. It will scan the directory and resume downloading the missing chunks.

---

## Step 6: Start the Model Server

Now, launch the inference API server on port 8095 using the Vulkan backend.

```bash
# Make sure TESLA_VULKAN_SERVER is set in scripts/config.env, then launch in foreground to monitor logs
bash scripts/serving/serve_vulkan.sh
```

### **What just happened?**
The launcher script starts your Vulkan-built `llama-server` on port 8095, configures a 32k context size, turns on Flash Attention, and loads the model into graphics memory. It hides the GPU from ROCm (`HIP_VISIBLE_DEVICES=-1`) and selects the `RADV` Vulkan driver.

### **What success looks like:**
Keep the terminal open and check the output log:
```text
llama_new_context_with_model: n_ctx = 32768, total VRAM = 21.7 GB
llama_server_listening: http://127.0.0.1:8095
```

### **What to do if it fails:**
* **Error: `amdgpu: allocation failed` or `hipErrorOutOfMemory`**
  You either forgot to reboot after setting the GTT size, or you did not source `set_hsa_env.sh` in the current terminal window. Close the server, run `source scripts/setup/set_hsa_env.sh`, and try again.
* **Error: Port 8095 already in use**
  Another process is occupying the port. Open `scripts/config.env` and change `TESLA_PORT` to a different number (e.g. `8096`), then run the script again.

---

## Step 7: Create the Agent Profile

In a separate terminal window, initialize the Hermes configuration so the agent can communicate with the server.

```bash
# Generate the profile config (run this from root directory)
bash scripts/serving/create_hermes_profile.sh
```

### **What just happened?**
The script creates a configuration file in `~/.hermes/profiles/qwen36_mxfp4/config.yaml` specifying our local server address and model names. It also creates a command launcher in `~/.local/bin/qwen36_mxfp4`.

### **What success looks like:**
```text
created Hermes profile: ~/.hermes/profiles/qwen36_mxfp4
created launcher:       ~/.local/bin/qwen36_mxfp4
```

### **What to do if it fails:**
* **Error: `qwen36_mxfp4: command not found`**
  Your user binary directory `~/.local/bin` is not in your system shell search path. Run:
  `export PATH="$HOME/.local/bin:$PATH"`
  And append this line to the end of your `~/.bashrc` file.
