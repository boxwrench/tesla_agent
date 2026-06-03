# Gemma 4 26B-A4B Control Baseline vs MTP on Strix Halo

June 2026 benchmark note.

This note records the plain Vulkan control baseline for Gemma 4 26B-A4B and the same-model MTP comparison on the reference Strix Halo box. The practical question was simple: when does the extra speculative machinery earn its keep, and when is the plain no-spec lane the cleaner default?

## Setup

- Vulkan/RADV backend on the Strix Halo reference box
- F16 KV enforced
- Reasoning off for the control baseline
- Hermes nonce gate: 3/3 pass

## Plain control baseline

The verified control run measured:

- `pp512 1002.76 ± 10.29 tok/s`
- `tg128 44.76 ± 0.90 tok/s`

That is a strong enough decode lane for general reasoning, JSON extraction, and prose. It is also the simpler serving path: no draft model, no speculative-drafting flags, and fewer chances to mismatch a speed tweak with the wrong prompt style.

## MTP comparison

The block-size-3 MTP comparison improved heavy code generation to `63.23 tok/s`, which is a real gain on the same hardware. But the non-code lanes were effectively flat:

- JSON / prose: `45.2-46.5 tok/s`
- VRAM footprint: about `21.7 GB` vs `21.3 GB` for the plain control lane
- Setup complexity: higher, because the draft parameters and speculative server flags become part of the serving contract

## Takeaway

The durable lesson is not that MTP is universally better. It is that the plain Gemma 26B control lane is a good default when you want general reasoning with fewer moving parts, while MTP is worth opting into only when the workload is code-heavy enough to use the extra speed.
