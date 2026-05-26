# Chapter 03: The Hardware — AMD Strix Halo and UMA

To run large AI models locally, you traditionally need a dedicated graphics card (GPU) with lots of Video RAM (VRAM), such as an NVIDIA RTX 4090. However, these cards are expensive and consume massive amounts of power.

This guide targets the **AMD Ryzen Strix Halo** APU (Accelerated Processing Unit). An APU combines the CPU and the GPU onto a single silicon chip, sharing a single massive memory pool.

---

## 1. Unified Memory Architecture (UMA)

In a traditional computer, the CPU and GPU are separated:
* The CPU uses system RAM (e.g., 64 GB of slow DDR5).
* The GPU uses dedicated VRAM (e.g., 16 GB of fast GDDR6).
* If a model is 20 GB, it cannot fit in the GPU's 16 GB memory. You are forced to run it on the CPU, which is incredibly slow.

In a **Unified Memory Architecture (UMA)** like Strix Halo:
* The CPU and GPU share the same physical memory pool (up to 128 GB of LPDDR5X).
* The GPU can access this memory directly at high speeds.
* This means you can load massive 35B or 122B parameter models that normally require dual datacenter GPUs, on a single compact computer.

---

## 2. The Graphics Translation Table (GTT)

By default, Linux limits how much system memory the GPU is allowed to allocate. Even if your computer has 128 GB of RAM, the operating system might restrict the GPU to only 16 GB or 32 GB.

To bypass this, we must configure the **Graphics Translation Table (GTT)**.
* GTT acts as a virtual bridge mapping system RAM for GPU computations.
* We must tell the Linux kernel: *"Override the safety limits and let the GPU allocate up to 75% of our RAM."*
* If you skip this configuration step, large models will fail to load, or the system will crash with an "out of graphics memory" error.

---

## 3. The Essential HSA Driver Overrides

Because the Strix Halo APU (graphics identifier `gfx1151`) is a new consumer architecture, the standard AMD ROCm driver does not support it automatically. We must inject a series of environment variables to force compatibility:

1. **`HSA_OVERRIDE_GFX_VERSION=11.5.1`**
   Instructs the ROCm library to treat our APU as a compatible `gfx1150`/`gfx1100` model.
2. **`HSA_ENABLE_SDMA=0`**
   Disables System Direct Memory Access. SDMA can cause silent lockups on unified APU systems when routing Mixture-of-Experts layers.
3. **`GPU_MAX_HEAP_SIZE=100` & `GPU_MAX_ALLOC_PERCENT=100`**
   Instructs the AMD driver to allow individual compute tasks to allocate up to 100% of the GTT pool.
4. **`GPU_FORCE_64BIT_PTR=1`**
   Forces 64-bit memory addressing, required to map buffers larger than 4 GB.
5. **`HIP_VISIBLE_DEVICES=0`**
   Exposes the APU graphics engine to ROCm (or set to `-1` to hide it and force Vulkan CPU/RADV shader routing).

---

## 4. Hardware Baseline

This guide targets the reference hardware baseline:
* **System RAM:** 128 GB LPDDR5X (Unified memory pool).
* **Optimal GTT Allocation:** 96 GB (`gttsize=98304`).
* **Graphics Compatibility:** AMD Radeon APU (exposed as `gfx1151`).

If your system has less memory, the large MoE and coder models will fail to load or trigger driver kernel page faults.

In the next chapter, we will walk through the development journey—the mistakes made, the dead ends hit, and how we arrived at this simple setup.
