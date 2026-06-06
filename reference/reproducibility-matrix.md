# Reproducibility Matrix & Technical Deep-Dive

This document compiles the exact methodology, hardware baseline, driver configurations, model checksums, performance metrics, and technical post-mortems of attempts and failures. It is designed to serve as the canonical public benchmark record for researchers and software engineers seeking to replicate, verify, or extend these benchmarks on AMD APU hardware.

The rest of the repository summarizes this file for different readers:

| Surface | Role |
|---|---|
| `README.md` | Orientation and short model ladder. |
| `guide/*.md` | Teaching path for utility professionals. |
| `reference/*.md` | Reproducibility, checksums, and decision support. |
| `research/*.md` | Long-form case studies and post-mortems. |
| `docs/` | GitHub Pages mirror of the public guide and interactive model finder. |

---

## 💻 1. Reference Testing Stack (The Baseline)

To ensure reproducibility, all benchmarks, evaluations, and tests were executed on the same physical host hardware and software configuration.

### A. Hardware Configuration
* **APU:** AMD Ryzen Strix Halo (Graphics Architecture: `gfx1151`, exposed as Radeon Graphics).
* **System memory:** 128 GB LPDDR5X (Unified Memory Architecture).
* **Graphics Allocation (GTT Size):** **96 GB** allocated for graphics memory mapping.
* **Kernel Parameters (`/etc/default/grub`):**
  ```bash
  amdgpu.gttsize=98304 amdgpu.no_system_mem_limit=1
  ```
  *(Note: 98304 MB = 96 GB. The `no_system_mem_limit` parameter is critical to prevent driver page faults when graphics allocation exceeds the default 50% system RAM limit).*

### B. Software Configuration
* **Operating System:** Linux (Ubuntu 24.04 LTS, Kernel `6.11.0-generic` or newer).
* **AMD Driver Suite:** ROCm 7.2.x (HIP runtime; 7.1.x also works).
* **Open Source Graphics Drivers:** Mesa 25.2.8 (RADV Vulkan compiler).
* **Inference Server:** `llama.cpp` / `llama-server` (stable build `b9247`; opt-in MTP lanes reproduced on `b9360`, commit prefix `6b4e4bd...`; Gemma QAT MTP probes on Atomic `b9019-0a635dcd9`).
* **Vulkan shader compiler for MTP lanes:** `glslc` built from source using shaderc `v2026.3-dev`. The distro `glslc` 2023.8 was too old for the reproduced MTP build.
* **Environment Overrides (`config.env`):**
  ```bash
  export HSA_OVERRIDE_GFX_VERSION=11.5.1
  export GPU_FORCE_64BIT_PTR=1
  export GGML_VK_FORCE_DISABLE_F16=0
  ```

---

## 📦 2. Model Artifact Manifest

The following models are used in the reference tests. Download paths are pinned to public Hugging Face repositories.

> **About the checksums:** these are `sha256sum` of the maintainer's local single-file GGUFs — use them to verify your own download is bit-identical (`sha256sum <file>`). Unsloth occasionally re-quantizes, so a live HF file may differ; treat a mismatch as "version drift," not corruption. The 122B is not currently on local disk, so its hash is unpinned — verify against the source repo.

| Model Identity | Format & Quant | File Name | Size (GB) | HF Source Repository | SHA256 (local copy) |
|---|---|---|---|---|---|
| **Qwen 3.6 35B MoE** | GGUF (MXFP4) | `Qwen3.6-35B-A3B-MXFP4_MOE.gguf` | 21.7 GB | [unsloth/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.6-35B-A3B-GGUF) | `2fdd20997c4d88ee25f70f500c61f8b999378d92ab055f9d450fc70d617158d3` |
| **Qwen 3.6 35B MoE MTP** | GGUF (MXFP4_MOE requant from Q8_0 MTP) | `Qwen3.6-35B-A3B-MTP-MXFP4_MOE.gguf` | 19.3 GB | [ggml-org/Qwen3.6-35B-A3B-MTP-GGUF](https://huggingface.co/ggml-org/Qwen3.6-35B-A3B-MTP-GGUF) | `1960416bb2cb9ec60cb297016b204ea73a70faaadf5401a62584e47ed2832c28` |
| **Qwen 3.6 35B MoE MTP** | GGUF (Q4_K_M requant from Q8_0 MTP) | `Qwen3.6-35B-A3B-MTP-Q4_K_M.gguf` | 20.7 GB | [ggml-org/Qwen3.6-35B-A3B-MTP-GGUF](https://huggingface.co/ggml-org/Qwen3.6-35B-A3B-MTP-GGUF) | `be11d472527e5013290b09c1afc12694a326a4184eb97cf58fff579a671dddc3` |
| **Gemma 4 31B IT** | GGUF (Q6_K) | `gemma-4-31B-it-Q6_K.gguf` | 25.2 GB | Unsloth GGUF release | `abd0be03a2bc3f3c9d8e018cbb4ff5b553c340c65d49b6b346c48be5a1efde28` |
| **gpt-oss-120B** | GGUF (MXFP4, 3 shards) | `gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf` | ~63 GB | Unsloth GGUF release | shard pins below |
| **Qwen 3.5 122B MoE** | GGUF (MXFP4) | `Qwen3.5-122B-A10B-MXFP4_MOE.gguf` | 70.0 GB | [unsloth/Qwen3.5-122B-A10B-GGUF](https://huggingface.co/unsloth/Qwen3.5-122B-A10B-GGUF) | *(unpinned — not on local disk; verify against source)* |
| **Qwen 3.5 122B MoE MTP** | GGUF (MXFP4_MOE, native MTP) | `Qwen3.5-122B-A10B-MTP-MXFP4_MOE.gguf` | ~70 GB | source pin pending in public mirror | *(unpinned — private benchmark artifact; publish checksum before external reproduction claim)* |
| **StepFun Step-3.7-Flash** | GGUF (UD-IQ4_XS, 3 shards) | `Step-3.7-Flash-UD-IQ4_XS-00001-of-00003.gguf` | 88.79 GiB | source pin pending in public mirror | *(download verified locally; public checksum pending)* |
| **StepFun Step-3.7-Flash MTP draft** | GGUF (Q8_0 draft) | `Step-3.7-Flash-MTP-Q8_0.gguf` | 3.5 GB | [notSnix/Step-3.7-Flash-Q4_K_M-MTP-GGUF](https://huggingface.co/notSnix/Step-3.7-Flash-Q4_K_M-MTP-GGUF) | *(download verified locally; public checksum pending)* |
| **Gemma 4 26B-A4B IT** | GGUF (UD-Q6_K_XL) | `gemma-4-26B-A4B-it-UD-Q6_K_XL.gguf` | 21.2 GB | Unsloth GGUF release | `5cfb7ab424c01388538005f26573f3bd374d3140cc021a1c44249e69928882a4` |
| **Gemma 4 26B-A4B IT QAT** | GGUF (Q4_0) | `gemma-4-26B_q4_0-it.gguf` | 13.45 GiB | [google/gemma-4-26B-A4B-it-qat-q4_0-gguf](https://huggingface.co/google/gemma-4-26B-A4B-it-qat-q4_0-gguf) | `4c856523d61d77922dbc0b26753a6bf6208e5d69d80db0c04dcd776832d054c5` |
| **Gemma 4 12B IT QAT** | GGUF (Q4_0) | `gemma-4-12b-it-qat-q4_0.gguf` | 6.50 GiB | [google/gemma-4-12B-it-qat-q4_0-gguf](https://huggingface.co/google/gemma-4-12B-it-qat-q4_0-gguf) | `faff1a63667fac17ac5e777f47114688fcefea96e220e211aaa8d62c2c4561f1` |
| **Gemma 4 31B IT QAT** | GGUF (Q4_0) | `gemma-4-31B_q4_0-it.gguf` | 16.44 GiB | [google/gemma-4-31B-it-qat-q4_0-gguf](https://huggingface.co/google/gemma-4-31B-it-qat-q4_0-gguf) | `0374ce7b0124db9ba96fc649e835c531223ee224a497ce88a374baaea10932ec` |
| **Qwen3-Coder-Next** | GGUF (UD-Q4_K_XL) | `Qwen3-Coder-Next-UD-Q4_K_XL.gguf` | 49.6 GB | [unsloth/Qwen3-Coder-Next-GGUF](https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF) | `4bb93f0a0221ef4ff963ca9094df629c8dfdfabc3b4fdd85c1a2e4c0624fce36` |
| **Qwen 3.5 35B MoE** | GGUF (MXFP4) | `Qwen3.5-35B-A3B-MXFP4_MOE.gguf` | 21.0 GB | [unsloth/Qwen3.5-35B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3.5-35B-A3B-GGUF) | `0f135a59159030f4710477abc6f9922d2f13552c85bff736deaaef71023cd770` |

### gpt-oss-120B MXFP4 per-shard SHA256

```text
gpt-oss-120b-mxfp4-00001-of-00003.gguf  e2865eb6c1df7b2ffbebf305cd5d9074d5ccc0fe3b862f98d343a46dad1606f9
gpt-oss-120b-mxfp4-00002-of-00003.gguf  346492f65891fb27cac5c74a8c07626cbfeb4211cd391ec4de37dbbe3109a93b
gpt-oss-120b-mxfp4-00003-of-00003.gguf  66dca81040933f5a49177e82c479c51319cefb83bd22dad9f06dad45e25f1463
```

### Qwen 3.6 35B-A3B MTP requant recipe

The opt-in MTP speed lanes start from the Q8_0 MTP source in `ggml-org/Qwen3.6-35B-A3B-MTP-GGUF` and requant locally:

```bash
llama-quantize --allow-requantize <Q8_0-MTP-input.gguf> <MXFP4-MTP-output.gguf> MXFP4_MOE
llama-quantize --allow-requantize <Q8_0-MTP-input.gguf> <Q4_K_M-MTP-output.gguf> Q4_K_M
```

The Q4_K_M-MTP SHA matches the artifact published by the community [strix-halo-guide](https://github.com/hogeheer499-commits/strix-halo-guide), which first pointed this repo at `--spec-type draft-mtp`.

---

## 📊 3. Performance & Quality Evaluation Metrics

### A. Nonce Gate Verification Methodology
The Nonce Gate tests the model's tool-calling reliability. The harness performs three checks:
1. **Tool-Call Structure:** Inspects the API payload to verify the model generated a JSON-formatted `tool_calls` request containing `"name": "terminal"` rather than raw text.
2. **Secret Extraction:** Writes a random 10-digit nonce (e.g. `1779764587`) into `/root/input/nonce.txt` inside a sandbox container, and checks if the model successfully extracts and echoes it in `/root/output/nonce.txt`.
3. **No Fenced Blocks:** Verifies that the model did not output markdown code blocks (e.g. ` ```bash cat nonce.txt `) instead of invoking the API tool.

### B. 4-Stage Coding Evaluation
Automated grading (`eval/coding/grade.py`) runs the agent through four sequential tasks:
1. **Telemetry QA:** Filter sensor anomalies (e.g. parsing `ERR` text cells) in a CSV file and output max values.
2. **Limit Checking:** Check database values against static threshold ranges and flag breaches.
3. **Log Error Parsing:** Parse log files, decode hexadecimal payloads (e.g., `0x455252` -> `ERR`), and identify error timestamps.
4. **Summary Report:** Synthesize findings into a clean markdown document.

### C. Hard Performance Numbers (ROCm vs Vulkan)

Benchmarks are measured in tokens/second (generation/decode speed) and quality scores (graded out of 84 points across 7 planning scorecard dimensions):

| Model Configuration | Inference Backend | Quality Score | Decode Speed | Prefill Speed | GTT Memory Allocation | Nonce Gate Result |
|---|---|---|---|---|---|---|
| **gpt-oss-120B MXFP4** — QUALITY baseline | **Vulkan RADV** | **Pairwise 5-1 vs Qwen 35B; 4-2 vs Qwen 122B** | **~46 tok/s** | not captured in stable run | ~63 GB | **3 / 3 Pass** |
| **Gemma 4 31B IT Q6_K** — second-opinion lane (dense — slow decode) | **Vulkan RADV** | **Pairwise 4-2 vs Gemma 26B-A4B** | **~8.25 tok/s tg128; ~7.7 tok/s sustained long completions** | pp8192 ~133.6 tok/s (verified) | 25.2 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** — **default** | **Vulkan RADV** | **82 / 84** | **~58.5 tok/s** | **932.1 tok/s** | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE MXFP4-MTP (Think-On)** — opt-in speed lane | **Vulkan RADV, llama.cpp b9360** | same production quant | **~72.7 tok/s** | not separately captured | 19.3 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE Q4_K_M-MTP (Think-On)** — opt-in speed lane | **Vulkan RADV, llama.cpp b9360** | **4-2 pairwise win vs production model** | **~81.2 tok/s** | not separately captured | 20.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-On)** — fallback | ROCm 7.2.x | **82 / 84** | **44.2 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.6 35B MoE (Think-Off)** | ROCm 7.2.x | **82 / 84** | **43.7 tok/s** | ~628.1 tok/s | 21.7 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-On)** — QUALITY spot-specialist | ROCm 7.2.x | **80 / 84** | **19.4 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE (Think-Off)** | ROCm 7.2.x | **81 / 84** | **19.5 tok/s** | ~136.0 tok/s | 70.0 GB | **3 / 3 Pass** |
| **Qwen 3.5 122B MoE MTP (DRAFT_N=1, PMIN unset)** — tuned Vulkan lane | **Vulkan RADV, llama.cpp b9360** | **80-81 / 84 role preserved; 3-3 quality tie vs previous MTP config** | **28.3 tok/s** | **324.9 tok/s** | ~70 GB | **3 / 3 Pass; coding PASS 5/5 E2E** |
| **StepFun Step-3.7-Flash + Q8_0 MTP draft** — large QUALITY contender | **Vulkan RADV, patched llama.cpp b9360** | **Plain StepFun pairwise: 6-0 vs gpt-oss-soulfix; 4-0-2 vs 122B; independent calibration still needed** | **26.0 tok/s** | **211.2 tok/s** | 88.79 GiB + 3.5 GB draft | **3 / 3 Pass; coding PASS 5/5 E2E** |
| **StepFun Step-3.7-Flash plain** — large QUALITY contender baseline | Vulkan RADV, llama.cpp b9360 | **6-0 vs gpt-oss-soulfix; 4-0-2 vs 122B; do not auto-graduate without independent judge** | **20.4-22.3 tok/s** | **212.0 tok/s** | 88.79 GiB | **3 / 3 Pass; coding 4/5 E2E** |
| **Gemma 4 26B-A4B IT UD-Q6_K_XL** *(verified plain-control baseline; think-off)* | Vulkan RADV | **Pairwise 2-4 vs Gemma 31B** | **44.76 ± 0.90 tok/s** | **pp512 1002.76 ± 10.29 tok/s** | 21.2 GB | **3 / 3 Pass** |
| **Gemma 4 26B-A4B QAT Q4_0** *(official Google QAT; think-off)* | Vulkan RADV, llama.cpp b9360 | quality control vs non-QAT Q4 pending | **59.4 tok/s** | **1194.4 tok/s** | 13.45 GiB | **3 / 3 Pass** |
| **Gemma 4 26B-A4B QAT Q4_0 + MTP/Q8 KV (QAT head)** | Atomic Vulkan b9019 | QAT-matched head; quality control pending | **71.4 tok/s** | **729.3 tok/s** | 13.45 GiB + ~310 MiB assistant | **3 / 3 Pass** |
| **Gemma 4 12B QAT Q4_0** | Vulkan RADV, llama.cpp b9360 | quality control pending | **25.7 tok/s** | **666.5 tok/s** | 6.50 GiB | not run |
| **Gemma 4 12B QAT Q4_0 + MTP/Q8 KV (QAT head)** | Atomic Vulkan b9019 | QAT-matched head; quality control pending | **45.6 tok/s** | **539.9 tok/s** | 6.50 GiB + ~313 MiB assistant | not run |
| **Gemma 4 31B QAT Q4_0** | Vulkan RADV, llama.cpp b9360 | quality control pending | **11.0 tok/s** | **204.2 tok/s** | 16.44 GiB | not run |
| **Gemma 4 31B QAT Q4_0 + MTP (QAT head)** | Atomic Vulkan b9019 | QAT-matched head; quality control pending | **19.1 tok/s** | **203.6 tok/s** | 16.44 GiB + ~337 MiB assistant | not run |
| **Qwen 3.6 27B Dense (Think-On)** *(experimental, not in stack)* | ROCm/Vulkan tested (UD-Q4_K_XL) | **0-6 vs Qwen 122B** | **9.6-11.5 tok/s** tested normal decode | not captured in stable run | 16.4 GB | **3 / 3 Pass** (coding 3/3) |
| **Qwen 3.6 27B Dense (Think-Off)** *(experimental, not in stack)* | ROCm/Vulkan tested (UD-Q4_K_XL) | — | **9.6-11.5 tok/s** tested normal decode | not captured in stable run | 16.4 GB | **3 / 3 Pass** (coding 1/3) |
| **Qwen 3.6 27B Dense + DFlash spec.** *(experimental)* | Lucebox HIP (Q4_K_M draft) | — | **~31.3 tok/s (2.82×)** | see acceptance table below | ~16 GB | discipline-limited |
| **Qwen 3.5 35B MoE (Think-On)** | ROCm 7.2.x | **79 / 84** | **47.3 tok/s** | ~562.9 tok/s | 21.0 GB | **3 / 3 Pass** |
| **Qwen3-Coder-Next (reasoning off)** — Vulkan promoted | **Vulkan RADV, llama.cpp b9360** | **One orchestrated 4-step coding run: all saved grader checks PASS** | **44.4 tok/s** | **723.2 tok/s** | 49.6 GB | **3 / 3 Pass recorded** |
| **Qwen3-Coder-Next (reasoning off)** — ROCm fallback | ROCm 7.2.x | baseline only | **38.5 tok/s** | **663.4 tok/s** | 49.6 GB | **3 / 3 Pass recorded** |

> **Stable Stack update (2026-06-06):** gpt-oss-120B remains the public general QUALITY baseline after blinded pairwise wins of 5-1 vs Qwen 35B and 4-2 vs Qwen 122B. StepFun Step-3.7-Flash is now a measured large-model QUALITY contender, including an MTP lane at 26.0 tok/s, but it is not silently promoted as the public default until an independent judge/calibration pass confirms the pairwise result. Qwen 122B is retained as a QUALITY spot-specialist for regulatory-currency work and sharp plan reviews; the tuned native-MTP Vulkan lane lifts it from ~19.4 tok/s to 28.3 tok/s with `DRAFT_N=1` and `PMIN` unset. Gemma 4 31B Q6 remains the cross-family second-opinion lane (coding experiment — quality verification, not throughput); Gemma 26B-A4B QAT Q4_0 is now the fastest general Gemma lane measured at 59.4 tok/s decode / 1194.4 tok/s prefill, while the older 26B-A4B UD-Q6_K_XL remains the verified non-QAT control at 44.76 ± 0.90 tok/s tg128 / pp512 1002.76 ± 10.29 tok/s. Qwen3-Coder-Next moved from the old ROCm row to the promoted Vulkan b9360 row at 44.4 tok/s decode / 723.2 tok/s prefill.
>
> **Speed correction:** a previous draft listed Gemma 31B at 43-48 tok/s, which was a misattribution of the gpt-oss-120B Vulkan speed. Verified Gemma 31B decode is ~8.25 tok/s tg128 / ~7.7 tok/s sustained (dense model; full weights read every token). For tasks where decode speed matters, prefer Qwen 3.6 35B MoE (~58.5 tok/s Vulkan; up to ~81.2 tok/s with opt-in MTP), gpt-oss-120B (~46 tok/s Vulkan), Qwen3-Coder-Next Vulkan (~44.4 tok/s), or the tuned 122B/StepFun MTP large-model lanes when their quality profile is worth the slower tier.
>
> **Status: the dense Qwen 3.6 27B is benchmarked but NOT in the production stack.** Community consensus often treats it as a strong reasoner, but local Strix Halo testing did not support that routing choice: blind pairwise was 0-6 vs the 122B on the standard 6-prompt set, and normal decode tested around 9.6-11.5 tok/s across backends. It is retained as a break-glass *"arrow in the quiver"* for tough, blocked projects — not a first- or second-line model. The speculative-decoding result below is kept as a technical finding.
>
> **DFlash speculative decoding on the dense 27B** lifts the dense route to **~31.3 tok/s (2.82×)** using a footprint-minimized Q4_K_M draft (HumanEval 2.57×, mean acceptance length 6.67, DDTree budget 22 — the gfx1151 sweet spot). Counter-intuitively the *smaller* Q4_K_M draft (1.03 GB) beats a larger Q8_0 draft (1.84 GB, only 1.49×): on this bandwidth-bound APU the draft's own weight reads compete for the same memory bus the target needs to verify, so minimizing draft footprint wins. This separate dense-model path remains useful as a technical finding; the Qwen 35B MoE speed path is native MTP, not DFlash. *Speed is verified; pairing this speed with full tool-call discipline on the same Q4_K_M build is still in validation (the verified 27B tool-call/coding passes above are on the UD-Q4_K_XL build).*

### D. Prefill and Speculative-Acceptance Coverage

The table above keeps missing instrumentation explicit. Decode rates are the main stable-run metric for gpt-oss and the Gemma 31B row; the Gemma 26B control baseline now has a captured `pp512` figure from the verified no-spec lane. A separate research note mentions a gpt-oss prompt-processing figure, but because it is not tied to the stable graduation protocol used above, it is not promoted into this matrix.

| Metric | Model / configuration | Captured value | Notes |
|---|---|---:|---|
| Prefill speed | Qwen 3.6 35B-A3B MXFP4, Vulkan/RADV | 932.1 tok/s | `pp8192` benchmark |
| Prefill speed | Qwen 3.6 35B-A3B MXFP4-MTP, Vulkan/RADV | not separately captured | rerun under the same protocol before publishing a value |
| Prefill speed | Qwen 3.6 35B-A3B Q4_K_M-MTP, Vulkan/RADV | not separately captured | rerun under the same protocol before publishing a value |
| Prefill speed | Qwen 3.6 35B-A3B MXFP4, ROCm | ~628.1 tok/s | `pp8192` benchmark |
| Prefill speed | Qwen 3.5 122B-A10B MXFP4, ROCm | ~136.0 tok/s | quality route benchmark |
| Prefill speed | Qwen 3.5 122B-A10B MTP MXFP4_MOE, Vulkan/RADV | **324.9 tok/s** | tuned `DRAFT_N=1`, `PMIN` unset |
| Prefill speed | StepFun Step-3.7-Flash MTP, Vulkan/RADV | **211.2 tok/s** | MTP lane; paired baseline measured 212.0 tok/s |
| Prefill speed | Qwen 3.5 35B-A3B MXFP4, ROCm | ~562.9 tok/s | planning route benchmark |
| Prefill speed | Qwen3-Coder-Next UD-Q4_K_XL, Vulkan/RADV | **723.2 tok/s** | promoted b9360 coding challenger |
| Prefill speed | Qwen3-Coder-Next UD-Q4_K_XL, ROCm | **663.4 tok/s** | fallback baseline |
| Prefill speed | gpt-oss-120B MXFP4 | not captured | rerun under the same protocol before publishing a value |
| Prefill speed | Gemma 4 26B-A4B IT Q6_K_XL | **pp512 1002.76 ± 10.29 tok/s** | verified plain-control baseline; reasoning off, F16 KV |
| Prefill speed | Gemma 4 26B-A4B QAT Q4_0, plain F16 KV | **1194.4 tok/s** | official Google QAT GGUF; llama.cpp b9360 Vulkan/RADV |
| Prefill speed | Gemma 4 26B-A4B QAT Q4_0, MTP + Q8 KV (QAT head) | **729.3 tok/s** | QAT-matched head; Atomic b9019 |
| Prefill speed | Gemma 4 12B QAT Q4_0, plain F16 KV | **666.5 tok/s** | official Google QAT GGUF; llama.cpp b9360 Vulkan/RADV |
| Prefill speed | Gemma 4 12B QAT Q4_0, MTP + Q8 KV (QAT head) | **539.9 tok/s** | QAT-matched head; Atomic b9019 |
| Prefill speed | Gemma 4 31B QAT Q4_0, plain Q8 KV | **204.2 tok/s** | official Google QAT GGUF; llama.cpp b9360 Vulkan/RADV |
| Prefill speed | Gemma 4 31B QAT Q4_0, MTP F16 KV (QAT head) | **203.6 tok/s** | QAT-matched head; Atomic b9019 |
| Prefill speed | Gemma 4 31B IT Q6_K | **pp8192 ~133.6 tok/s** (controlled local GPU benchmark, b9247 57ebaf4e) | verified; decode ~8.25 tok/s tg128, ~7.7 tok/s sustained |
| Speculative acceptance length | Qwen 3.6 27B Dense + Q4_K_M DFlash draft | AL = 6.67 | HumanEval mean at DDTree budget 22 |
| Speculative acceptance percentage | Qwen 3.6 27B Dense + Q4_K_M DFlash draft | not captured | do not derive a percent from AL; rerun if acceptance-rate counters are needed |
| Speculative acceptance length | Qwen 3.6 27B Dense + Q8_0 DFlash draft | not captured | speedup was captured, but AL / acceptance percent were not |
| MTP draft acceptance | Qwen 3.5 122B-A10B MTP, `DRAFT_N=1`, `PMIN` unset | **81.8%** | from dedicated `mtp_probe.json` sample: 224 accepted / 274 drafted; standard decode run was 80.8% |
| MTP draft acceptance | StepFun Step-3.7-Flash + Q8_0 MTP draft | **84.7%** | from raw `tg_probe.json` timing counters: 416 accepted / 491 drafted; aggregate `bench.json` field is null |
| MTP draft acceptance | Gemma 4 26B-A4B QAT Q4_0 + non-QAT 26B assistant head | **56.9%** | mismatched head baseline; superseded by QAT-matched row |
| MTP draft acceptance | Gemma 4 26B-A4B QAT Q4_0 + QAT-matched 26B assistant head (Q8_0) | **91.8%** | canonical QAT MTP row; 71.4 tok/s decode, 29.6 s wall std |
| MTP draft acceptance | Gemma 4 12B QAT Q4_0 + QAT-matched 12B assistant head (Q8_0) | **78.4%** | 45.6 tok/s decode, 46.0 s wall std; single-slot |
| MTP draft acceptance | Gemma 4 12B QAT Q4_0 + QAT-matched 12B assistant head (Q8_0), PARALLEL=2 | **88.6%** | 38.6 tok/s raw / 48.6 eff., 62.5 tok/s 2-slot agg; post-fix |
| MTP draft acceptance | Gemma 4 31B QAT Q4_0 + non-QAT 31B assistant head | **42.5%** | mismatched head baseline; superseded by QAT-matched row |
| MTP draft acceptance | Gemma 4 31B QAT Q4_0 + QAT-matched 31B assistant head (Q8_0) | **60.4%** | 19.1 tok/s decode, 110.4 s wall std |

### Gemma 4 QAT Q4_0 sweep

QAT means quantization-aware training: the model is trained or adapted while accounting for the low-precision target format, with the goal of retaining more behavior at Q4 than a simple post-training quantization. The speed comparison against older Q6 rows mostly shows the benefit of smaller Q4 artifacts; QAT earns its keep only if quality holds against ordinary non-QAT Q4/K-quant controls. Those controls are still pending.

All MTP rows below use QAT-matched assistant heads converted from Google's official unquantized QAT assistant repos (`google/gemma-4-{12B,26B-A4B,31B}-it-qat-q4_0-unquantized-assistant`), quantized to Q8_0 and loaded via the Atomic llama.cpp TurboQuant fork. The earlier non-QAT head rows (now marked "non-QAT head") are retained for comparison.

| Lane | Load to listening | Prefill | Decode | Normalized wall, 1150-in/2000-out | Two-slot aggregate | Notes |
|---|---:|---:|---:|---:|---:|---|
| Gemma 4 26B-A4B QAT Q4_0, plain F16 KV | ~4 s | 1194.4 tok/s | 59.4 tok/s | 34.6 s | 90.9 tok/s | best general QAT row; best two-slot |
| Gemma 4 26B-A4B QAT Q4_0, MTP + Q8 KV (QAT head) | ~18 s | 729.3 tok/s | **71.4 tok/s** | **29.6 s** | 62.5 tok/s | **91.8% acceptance**; fastest single-stream row |
| Gemma 4 26B-A4B QAT Q4_0, MTP + Q8 KV (non-QAT head) | ~18 s | 714.4 tok/s | 71.0 tok/s | 29.8 s | 55.6 tok/s | 56.9% acceptance; head-mismatch baseline |
| Gemma 4 12B QAT Q4_0, plain F16 KV | ~4 s | 666.5 tok/s | 25.7 tok/s | 79.5 s | 47.6 tok/s | slower than 26B-A4B on this stack |
| Gemma 4 12B QAT Q4_0, MTP + Q8 KV (QAT head) | ~10 s | 539.9 tok/s | **45.6 tok/s** | **46.0 s** | 43.5 tok/s | **78.4% acceptance**; +77% vs plain; single-slot |
| Gemma 4 12B QAT Q4_0, MTP + Q8 KV (QAT head, PARALLEL=2) | ~8 s | 550.6 tok/s | 38.6 tok/s (48.6 eff.) | 53.9 s | **62.5 tok/s** | **88.6% acceptance**; post-fix; `LLAMA_PIPELINE_DEPTH2=0` required; +31% vs plain 2-slot |
| Gemma 4 31B QAT Q4_0, plain Q8 KV | ~8 s | 204.2 tok/s | 11.0 tok/s | 187.4 s | 20.0 tok/s | best plain 31B QAT row |
| Gemma 4 31B QAT Q4_0, MTP F16 KV (QAT head) | ~20 s | 203.6 tok/s | **19.1 tok/s** | **110.4 s** | 18.9 tok/s | **60.4% acceptance**; +73% vs plain |
| Gemma 4 31B QAT Q4_0, MTP F16 KV (non-QAT head) | ~10 s | 118.0 tok/s | 15.4 tok/s | 139.6 s | 15.9 tok/s | 42.5% acceptance; head-mismatch baseline |

DDTree budget sweep for the dense 27B Q4_K_M draft:

| Budget | Mean acceptance length | Decode speed |
|---:|---:|---:|
| 8 | 4.56 | 26.26 tok/s |
| 16 | 5.59 | 24.22 tok/s |
| 22 | 6.67 | 27.99 tok/s |
| 32 | 6.69 | 23.68 tok/s |
| 45 | 6.72 | 22.64 tok/s |
| 64 | 7.06 | 17.62 tok/s |

---

## 🛠️ 4. Technical Post-Mortems: What Failed & Why

In developing this reference setup, several highly recommended ML pipelines failed on Strix Halo APU systems. Seasoned developers should review these post-mortems to avoid repeating identical dead ends.

### A. The vLLM ROCm Warmup Timeout (Attempt 1)
* **What we tried:** Running models through `vLLM` using the ROCm compute backend to leverage vLLM's PagedAttention and throughput optimizations.
* **Why it failed:** On launch, vLLM compiles custom ROCm PyTorch kernels (HIP graphs) optimized for the GPU. On consumer APUs like Strix Halo, this LLVM kernel compilation process took **over 25 minutes** to warm up on startup. During this time, HTTP client harnesses and systemd services timed out, leading to process crashes.
* **The Solution:** Swapped to `llama.cpp` / `llama-server`. Since `llama.cpp` loads pre-compiled Vulkan shaders or ROCm kernels, the model loads and becomes queryable in **less than 2 seconds**.

### B. MoE Speculative Decoding Latency Penalty (Attempt 2)
* **What we tried:** Accelerating `Qwen 3.6 35B MoE` decoding speed by using a separate tiny draft model (e.g. `Qwen 3.6 3B`) or older speculative target-tensor paths to predict text tokens, which are verified in batches by the 35B MoE.
* **Why it failed:** Those older paths relied on a separate draft pass being extremely fast and the validation step being cheap. On the tested MoE route, validating speculative tokens forced the gating router to constantly swap and evaluate different expert weights. That router evaluation penalty added enough latency that the old path **slowed down** generation by ~10%.
* **What changed:** Native MTP is different. The Qwen3.6-35B-A3B-MTP GGUFs carry their own `nextn` head, so `--spec-type draft-mtp` self-speculates without a separate draft model. On b9360 with current shaderc, this produced the opt-in MXFP4-MTP and Q4_K_M-MTP speed lanes above.
* **The Latency Lever (with a caveat):** Use **Reasoning Budgets** (`thinking_budget_tokens`) to cap how many tokens the model spends "thinking." On **planning / prose** workloads this cuts wall-clock substantially without expert-routing overhead. **But do NOT cap the CODE route:** a controlled budget sweep found that *no* bounded budget reliably holds the stateful coding gate — only unrestricted think-on scored 3/3, while caps (512/256/128) dropped to 1–2/3 and were non-monotonic (variance on the Step-2 trap dominated). So reasoning budgets are a *planning* latency lever, not a coding one; keep the coding route on unrestricted think-on.
* **The Real Speedups:** DFlash speculative decoding works on dense models — 2.82× on the dense 27B — and native MTP now works for Qwen 3.6 35B MoE when using the MTP GGUFs and `--spec-type draft-mtp`. Match the acceleration method to the model artifact and build.

### C. 122B MoE VRAM Spillover Hangs (Attempt 3)
* **What we tried:** Running `Qwen 3.5 122B MoE` (70.0 GB) with a large context size (32,768 tokens) on the 128 GB system.
* **Why it failed:** Although the base weights (70 GB) fit comfortably inside the 96 GB GTT limit, scaling the context window to 32k requires a massive KV cache allocation in graphics memory. This context allocation exceeded the 96 GB limit, causing GPU allocations to spill over into general system RAM. This triggered kernel driver conflicts, resulting in GPU ring timeouts and system freezes.
* **The Solution:** Pinned the maximum context size of the 122B model to a safe **12,288 tokens** (verified working cap; an 8k–12k range stays inside the GTT limit). This keeps memory consumption within the GTT limit and prevents driver hangs.

### D. Speculative Decoding Spec-Defect (`--spec-dec` Crashes)
* **What we tried:** Enabling speculative decoding flags directly inside the llama-server invocation for MoE models.
* **Why it failed:** The spec-dec engine failed to correctly load and synchronize the tokenizers of the draft model and the MoE model, resulting in parsing mismatch errors and immediate server crashes.
* **The Lesson:** Do not generalize one speculative path to every model. Separate-draft MoE speculation and older `--spec-dec` paths were counterproductive or crash-prone in this stack. Native MTP on Qwen3.6-35B-A3B-MTP is a different path and did produce a quality-preserving speed lane. Dense DFlash still works on the dense 27B because there is no expert router to thrash during draft verification.

### E. Qwen 3.6 35B-A3B MTP Serve Flags

Use these flags for the opt-in MTP lanes measured above:

```bash
--spec-type draft-mtp --spec-draft-n-max 2 -ub 1024 --poll 100 -fa on --cache-type-k f16 --cache-type-v f16
```

Draft acceptance in the reproduced runs was approximately **71-80%**. Greedy decoding was used; the value of the lane is lossless self-speculation on quants that hold this repo's quality bar.
