# Gemma 4 QAT Q4_0 Bench on Strix Halo

June 2026 benchmark note.

These are Google's official Gemma 4 QAT Q4_0 GGUF models, served locally through llama.cpp Vulkan/RADV on the reference Strix Halo box.

QAT means **quantization-aware training**. Instead of taking a normal model and quantizing it only after training, the model is trained or adapted while accounting for the lower-precision format it will run in. The goal is to make a small Q4 model keep more of the original model's behavior than a simple post-training quantization.

## Host and backend

- AMD Ryzen AI Max+ 395 / Radeon 8060S class Strix Halo APU (`gfx1151`)
- 128 GB unified LPDDR5X
- 96 GiB GTT known-good stack
- Linux Mint 22.3 / Ubuntu noble base
- Kernel `6.17.0-23-generic`
- Mesa 25.2.8 / RADV
- Plain rows: llama.cpp Vulkan/RADV b9360
- MTP rows: Atomic Vulkan b9019, existing non-QAT assistant heads

## Model artifacts

| Model | File | Size | SHA256 |
|---|---|---:|---|
| Gemma 4 12B QAT Q4_0 | `gemma-4-12b-it-qat-q4_0.gguf` | 6.50 GiB | `faff1a63667fac17ac5e777f47114688fcefea96e220e211aaa8d62c2c4561f1` |
| Gemma 4 26B-A4B QAT Q4_0 | `gemma-4-26B_q4_0-it.gguf` | 13.45 GiB | `4c856523d61d77922dbc0b26753a6bf6208e5d69d80db0c04dcd776832d054c5` |
| Gemma 4 31B QAT Q4_0 | `gemma-4-31B_q4_0-it.gguf` | 16.44 GiB | `0374ce7b0124db9ba96fc649e835c531223ee224a497ce88a374baaea10932ec` |

## Measured rows

| Lane | Load to listening | Prefill | Decode | Normalized wall, 1150-in/2000-out | Two-slot aggregate | Notes |
|---|---:|---:|---:|---:|---:|---|
| Gemma 4 26B-A4B QAT Q4_0, plain F16 KV | ~4 s | 1194.4 tok/s | 59.4 tok/s | 34.6 s | 90.9 tok/s | best general row |
| Gemma 4 26B-A4B QAT Q4_0, MTP + Q8 KV | ~18 s | 714.4 tok/s | 71.0 tok/s | 29.8 s | 55.6 tok/s | fastest single-stream row |
| Gemma 4 12B QAT Q4_0, plain F16 KV | ~4 s | 666.5 tok/s | 25.7 tok/s | 79.5 s | 47.6 tok/s | slower than 26B-A4B on this stack |
| Gemma 4 31B QAT Q4_0, plain Q8 KV | ~8 s | 204.2 tok/s | 11.0 tok/s | 187.4 s | 20.0 tok/s | best plain 31B row |
| Gemma 4 31B QAT Q4_0, MTP F16 KV | ~10 s | 118.0 tok/s | 15.4 tok/s | 139.6 s | 15.9 tok/s | speed-only experimental row |

## Draft acceptance

| MTP row | Acceptance | Effective acceptance-adjusted decode |
|---|---:|---:|
| 26B-A4B QAT + existing 26B assistant head | 56.9% | 56.8 tok/s |
| 31B QAT + existing 31B assistant head | 42.5% | 16.2 tok/s |

The assistant heads used here are existing non-QAT assistant heads, not QAT-matched heads. That likely contributes to the lower acceptance rates. Treat the MTP rows as speed probes, not final trusted defaults.

## Context against previous local Gemma rows

| Model / lane | Quant / path | Prefill | Decode |
|---|---|---:|---:|
| Gemma 4 26B-A4B non-QAT | UD-Q6_K_XL, plain Vulkan | 1002.8 tok/s | 44.8 tok/s |
| Gemma 4 26B-A4B QAT | Q4_0, plain Vulkan | 1194.4 tok/s | 59.4 tok/s |
| Gemma 4 26B-A4B QAT | Q4_0 + MTP/Q8 KV | 714.4 tok/s | 71.0 tok/s |
| Gemma 4 31B non-QAT | Q6 plain Vulkan | 151.3 tok/s | ~8.1 tok/s |
| Gemma 4 31B QAT | Q4_0 plain Vulkan | 204.2 tok/s | 11.0 tok/s |
| Gemma 4 31B QAT | Q4_0 + MTP | 118.0 tok/s | 15.4 tok/s |
| Gemma 4 12B QAT | Q4_0 plain Vulkan | 666.5 tok/s | 25.7 tok/s |

## Takeaway

On the reference 128 GB Strix Halo APU, Google's official Gemma 4 26B-A4B QAT Q4_0 GGUF is the strongest Gemma speed lane measured so far: about **59 tok/s plain** and about **71 tok/s** with the experimental MTP/Q8 setup.

The next useful comparison is quality. QAT is supposed to preserve behavior better at Q4, but speed alone does not prove that. A fair quality check should compare the QAT Q4_0 model against ordinary non-QAT Q4/K-quant Gemma controls.
