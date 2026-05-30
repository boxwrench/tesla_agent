# Research Synthesis — American Stack Diligence

**Sources synthesized:**
- `compass_artifact_wf-7e76a5cb-9ee3-408d-9843-d173bc40df83_text_markdown.md` — heavily sourced (PR #s, HF URLs, localbench KL data, explicit caveats). Treated as primary; specific claims cited where load-bearing.
- `Research Implementation Plan Outline.md` — Gemini-style synthesis report. Treated as **suspect** per maintainer's prior experience with this model's tendency toward fluently-plausible-but-unsupported claims. Used as a cross-check only; divergences from compass are flagged for verification below.

**Reading order:** Action Summary → Confirmed facts (both sources agree) → Diverging claims (compass-grounded vs Gemini-claimed) → Open verification items → Updates landing in plan.md.

---

## 1. Action Summary

| Decision | Outcome | Source confidence |
|---|---|---|
| **Model name correction** | "Gemma 4 26B A4B IT Thinking" → `google/gemma-4-26B-A4B-it`; "Gemma 4 31B IT Thinking" → `google/gemma-4-31B-it`. **There is no separate "-Thinking" checkpoint** — Thinking is a runtime toggle (`enable_thinking` / `--reasoning-budget` / `--reasoning off`) on the single IT model. | BOTH agree — high confidence |
| **gpt-oss 120B publisher** | **`ggml-org/gpt-oss-120b-GGUF`** (cleanest llama.cpp path) as primary; **`unsloth/gpt-oss-120b-GGUF`** as alternate if we want their template patches. Avoid `bartowski/openai_gpt-oss-120b-GGUF-MXFP4-Experimental` (pre-merge experimental). | compass-sourced; Gemini says `second-state/gpt-oss-120b-GGUF` — **divergent, lower priority** |
| **gpt-oss 120B file shape** | 3 MXFP4 shards: `gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf`; ~13 MB / ~31.7 GB / ~31.6 GB; **~63.4 GB total, weights ~60.8 GB**. Pass shard 1 to `-m`; llama.cpp auto-loads the rest. | compass-sourced |
| **Gemma 4 26B A4B publisher** | **`unsloth/gemma-4-26B-A4B-it-GGUF`** (actively patched chat templates) as primary; bartowski as alternate. File: `gemma-4-26B-A4B-it-Q6_K.gguf` (~21–22 GB) or `…-UD-Q6_K_XL.gguf` (Unsloth Dynamic). | compass-sourced; Gemini prefers bartowski (acceptable alternate, not wrong) |
| **Gemma 4 31B publisher** | **`unsloth/gemma-4-31B-it-GGUF`** primary; file `gemma-4-31B-it-Q6_K.gguf`, **25.2 GB**, SHA256 `abd0be03a2bc3f3c9d8e018cbb4ff5b553c340c65d49b6b346c48be5a1efde28` (commit 3f07b20, "New Gemma chat template update by Google"). bartowski alternate `google_gemma-4-31B-it-Q6_K.gguf` 26.7 GB. | compass-sourced; SHA pinnable on download |
| **Re-quant churn** | **HIGH for both Gemmas** — unsloth/bartowski reissued multiple times for template bug fixes (Apr 8 `<unused24>`, Apr 11 Google template + llama.cpp fixes, later "New Gemma chat template update by Google"). Pull a **post-April-11** GGUF and pin SHA. gpt-oss churn is LOW/MODERATE. | compass-sourced |
| **KV cache for Gemma** | **F16 for both Gemma sizes.** localbench measured q8_0 KV KL = 0.108 (31B) and **0.377 (26B A4B)** — 3.5× worse on the 26B. q4_0 KV reaches KL 1.088 on the 26B. **Do NOT use `--cache-type-k q8_0` on Gemma.** | compass-sourced (localbench); Gemini-divergent (Gemini recommends q8_0 KV for Gemma — **wrong**) |
| **KV cache for gpt-oss** | **q8_0 acceptable**, F16 if you want maximum margin. No comparable Gemma-style sensitivity reported. | compass-sourced |
| **gpt-oss CPU offload** | **DO NOT** `--n-cpu-moe` or `-ot ".ffn_.*_exps.=CPU"` on Strix Halo. The whole point of 96 GiB GTT is unified-memory GPU access; CPU offload defeats it. Use `-ngl 999 --no-mmap --mlock`. | compass-sourced (explicit: "no `--n-cpu-moe` needed (that flag is only for small-VRAM machines)"); **Gemini's command line is wrong for our hardware** |
| **rocWMMA on gfx1151** | **DO NOT enable** `-DGGML_HIP_ROCWMMA_FATTN=ON`. Strix Halo Wiki: "as of ROCm 7.0.2+ the ROCWMMA flag/path SHOULD NOT BE USED for Strix Halo with llama.cpp upstream — it's slower than the regular ROCm/HIP path as context depth increases." Already aligned with HANDOFF Theme 1's `SM80_EQUIV=ON` note for Lucebox; here, just don't compile-flag it for ROCm. | compass-sourced |
| **GTT ceiling** | Our current 96 GiB (`gttsize=98304`, KNOWN-GOOD-pinned) is adequate. The 120-GiB target (`gttsize=120000`) Gemini proposes is unnecessary for our quants — 63 GB gpt-oss + KV fits in 96 with headroom. | Verified locally; Gemini's larger value isn't wrong, just not needed for this stack |
| **Quant floor for Gemma 31B (dense)** | **Q6_K = high-fidelity, not mandatory.** Q5_K_M adequate (KL ≈ 0.20 vs BF16); Q4_K_M usable floor; quality "drops fast" below Q5_K_S. Long docs and non-Latin scripts degrade fastest even at Q8_0. | compass-sourced (localbench) |
| **Quant floor for Gemma 26B A4B (MoE)** | **Q6_K is the prudent choice — more quant-sensitive than the 31B dense.** Q8_0 KL ≈ 0.544 / 77.9% top-1 (vs 0.16 for the 31B dense). Dropping to Q4_K_M is riskier here. localbench calls it "the most quantization-sensitive model tested so far." | compass-sourced; Gemini contradicts (recommends Q4_K_M as the practical baseline for 26B) — **divergent** |
| **Quant floor for gpt-oss 120B** | **MXFP4 only.** MoE weights (~90% of params) are *trained* MXFP4. Q6_K / Q8_0 only raises precision on the non-expert layers and adds bytes for ~no quality. Q4_K_M would degrade attention/embed below MXFP4 effective fidelity. | compass-sourced; Gemini agrees |
| **Backend choice on gfx1151** | **Vulkan/RADV is the more consistent path** for gpt-oss-120B specifically (TheRock #1957 ROCm-preview loading regression). ROCm fine for Gemma. Vulkan-side gpt-oss Jinja bug (#15274) and "Vulkan version and gpt-oss-20b-MXFP4" (#17039) are the counter-risk. **Test both on b9247.** | compass-sourced; Gemini also says "ROCm fails on gpt-oss MoE, use Vulkan" but cites it more absolutely than compass does |
| **gpt-oss multi-turn crash** | **Regression #20500 — `Cannot pass both content and thinking in an assistant message with tool calls` reproduced on gfx1151 Strix Halo.** Lost in autoparser refactor #18675; re-fix submitted. Verify whether it's in b9247 (May 20) or only in b9374 (May 28). **Highest-priority known bug for our stack.** | compass-sourced |
| **Gemma `<unused49>` infinite loop** | Headline Gemma 4 bug — model emits `<unused49>` indefinitely, fills max_tokens, empty `reasoning_content`. Partial fixes #21343 (tokenizer, merged) + #21506 (FFN MoE F32) predate b9247; some reports remain open. Workaround: server restart, current GGUF, `asf0/gemma4_jinja` template, `--reasoning off` for deterministic tool-calling first. | compass-sourced; Gemini does not mention this bug — **omission flag** |
| **Gemma tool-call token leakage** | Issue #21316 — `<|channel|>thought` markers bleeding into tool-call JSON. Community template `asf0/gemma4_jinja` exists specifically to stop this. | compass-sourced |
| **gpt-oss reasoning format** | `--reasoning-format auto` (current recommended). Reasoning lands on `analysis` channel; final answer on `final` channel. Server parses analysis into `reasoning_content`, returns `final` as visible `content`. **Set reasoning effort via `chat_template_kwargs:{"reasoning_effort":"high"}` or CLI — top-level API field is ignored.** | compass-sourced |
| **gpt-oss sampling** | OpenAI recommends **temperature 1.0, top_p 1.0, no repetition penalties.** Hermes profile must not inject default repeat penalty. | compass-sourced |
| **Strix Halo ROCm PP regression** | Commit 668ed76 (PR #17576, "HIP: enable WMMA-MMQ INT kernels for RDNA 3") **introduced a prompt-processing regression on Strix Halo / ROCm 7.x for gpt-oss-120B.** If ROCm PP is slow, use a pre-668ed76 build or Vulkan. | compass-sourced |
| **Order of attack** | **1) gpt-oss-120B first** (mature Harmony parser, easiest win once #20500 verified) → **2) Gemma 4 31B IT** (dense, fewer surprises than the MoE) → **3) Gemma 4 26B A4B IT last** (the discipline-hardest gate). | compass-sourced ranking; Gemini ranks 26B easiest, 120B hardest — **directionally inverted, see divergence log** |

## 2. What Both Sources Agree On (high confidence)

- All three models are real and released (Gemma 4 family Apr 2 2026; gpt-oss 120B Aug 5 2025). llama.cpp `b9247` is real (May 20 2026); commit `57ebaf4`.
- Gemma 4 26B A4B is MoE (~25.2B total / ~3.8B active, 128 experts + 1 shared, Top-4 routing); Gemma 4 31B is dense; gpt-oss 120B is MoE (117B / 5.1B active, 128 experts, Top-4, 36 layers).
- MXFP4 is the right quant for gpt-oss 120B (~60.8 GB weights; ~63 GB display).
- Q6_K is the target for the two Gemmas (with disagreement on whether it's mandatory — see §3).
- Gemma 4 uses a different chat-template family than Qwen ChatML — special control tokens including a thought channel.
- gpt-oss 120B uses the **Harmony** format (`o200k_harmony` tokenizer); `<|channel|>analysis`, `<|channel|>final`, `<|start|>`, `<|message|>`, `<|end|>`, `<|call|>`, `<|return|>`.
- llama.cpp's bundled gpt-oss template works (`-hf ggml-org/gpt-oss-120b-GGUF -c 0 --jinja` is the documented quick-start).
- Both Gemmas: 256K native context; gpt-oss: 131K native context.
- `-fa on` is beneficial for gpt-oss (attention sinks → up to 3× PP); for Gemma it works but historically had a Vulkan+AMD crash on very large single prompts — validate.
- Lemonade's nightly `llamacpp-rocm` is real and targets gfx1151.

## 3. Diverging Claims — Compass-Grounded vs Gemini-Claimed

These are the points where the two reports disagree. **Compass is the trusted source unless we independently verify Gemini's claim.** Items here are flagged for the gate-time verification log.

| Topic | Compass claim (trust) | Gemini claim (flag) | Action |
|---|---|---|---|
| **gpt-oss authoritative publisher** | `ggml-org/gpt-oss-120b-GGUF` (cleanest llama.cpp path), `unsloth/gpt-oss-120b-GGUF` (template fixes pushed upstream) | `second-state/gpt-oss-120b-GGUF` is authoritative | Use compass picks. Do not pull from second-state without verifying it's not a derivative repo. |
| **KV cache type for Gemma** | F16 only (localbench KL: q8_0 = 0.108 / 0.377 for 31B / 26B; q4_0 = 1.088 for 26B) | `--cache-type-k q8_0 --cache-type-v q8_0` is fine, "negligible loss in accuracy" | **F16. Gemini is wrong on hardware that's not memory-constrained — we have 96 GiB.** |
| **gpt-oss MoE expert offload** | NO CPU offload — Strix Halo unified memory makes `-ngl 999 --no-mmap --mlock` correct; `--n-cpu-moe` is explicitly for "small-VRAM machines" | `-ot ".ffn_.*_exps.=CPU"` to selectively offload experts to CPU under "strict unified memory envelope like 96 GiB GTT" | **Compass. Gemini's reasoning is backwards for unified memory — on Strix Halo, "GPU memory" IS system memory; offloading experts to CPU just adds copy overhead without freeing anything meaningful.** |
| **Gemma 26B A4B quant floor** | Q6_K is prudent; the MoE is "the most quantization-sensitive model tested so far"; even Q8_0 KL ≈ 0.544 | Q4_K_M is the practical baseline; "delivers excellent prompt processing speeds of approximately 500 to 600 tokens per second" | **Compass. Q4_K_M may be tempting for speed but eats more quality on the MoE than on the dense, per localbench. Stay at Q6_K.** |
| **rocWMMA on gfx1151** | Strix Halo Wiki: "ROCWMMA flag/path SHOULD NOT BE USED for Strix Halo … slower than the regular ROCm/HIP path as context depth increases" | "Flash attention (-fa on) uses the rocWMMA instruction set to speed up attention calculations" | **Compass. -fa on works without rocWMMA; do not enable the rocWMMA compile flag for gfx1151.** |
| **Easiest gate to pass** | gpt-oss 120B (mature Harmony parser, beat vLLM in tool-calling) | Gemma 4 26B A4B (easiest to serve; "high serviceability") | **Compass. Gemma's `<unused49>` loop + tool-call token leakage are the active discipline bugs; gpt-oss Harmony parsing is more stable when #20500 is fixed.** |
| **Hermes profile YAML** | Not addressed in detail | Provides specific YAML examples with `provider: "custom"`, `chat_template_kwargs: enable_thinking: true`, `API_SERVER_*` env vars, Docker volume mounts | **Format roughly matches our existing Qwen profiles, but the specific keys (`API_SERVER_ENABLED`, `API_SERVER_PORT`, `API_SERVER_KEY`) are not Hermes shape — looks fabricated. Use our existing `qwen36plan` profile as the structural template instead.** |
| **GRUB ttm settings** | Not specifically named; references existing kernel-param GTT tuning | `GRUB_CMDLINE_LINUX_DEFAULT="quiet splash ttm.pages_limit=30720000 amdgpu.gttsize=120000"` (≈120 GiB GTT via GRUB) | **Our verified config (KNOWN-GOOD.md) uses modprobe.d, not GRUB, and pins 96 GiB. Gemini's path works but is suboptimal placement — modprobe.d is more idempotent. Don't change our setup unless 96 GiB is proven insufficient.** |
| **Lemonade v10.3 / "OmniRouter"** | Not mentioned | Detailed "OmniRouter" / "System Info Consolidation" / "Channel Selection" features as v10.3 deliverables | **Unverified by compass; possibly hallucinated feature set. Treat as unknown until checked against Lemonade's actual release notes.** |
| **Specific Gemma 4 tool-call token syntax** | Cites Goose issue #9110 reverse-engineering the template; mentions `<|tool_call>`, `<|tool_response>` as part of complex Jinja macros | Gives concrete example: `<|tool_call>call:get_weather{location:<|"|>Seattle, WA<|"|>}<tool_call|>` and `<|tool_response>response:get_weather{temp:<|"|>55F<|"|>}<tool_response|>` | **Token names plausible, but the `<|"|>` string delimiter syntax and the `call:`/`response:` prefix pattern need verification against Google's actual model card. May be a fluent invention. Verify on first nonce-gate run.** |
| **ROCm 7.13.0 production readiness** | "Technology preview, not GA; AMD recommends ROCm 7.2.3 for production" | Recommends ROCm 7.13.0 with LLVM unroll fix as the path to use | **Compass. Use ROCm 7.2 (matches the official b9247 prebuilt label) for production gate runs; 7.13 only if a 7.2 issue forces us forward.** |
| **PR #21066 / "ROCm LLVM Shared Memory Optimization"** | Not mentioned | Cited as ROCm 7.2.1 / 7.13.0 fix that resolves "shared memory loop-unroll bug" with "2 to 3 times" speed impact | **Unverified by compass; PR # plausible but compass cites a different set of PRs (#17576/668ed76) for the *opposite* — a regression. Verify before treating as a known fix.** |

## 4. Open Verification Items (run during gate work)

When standing up each model, log a YES/NO on each of these:

- [ ] **Gemma 4 26B A4B Q6_K**: does loading + first generation succeed without `<unused49>` loop on b9247?
- [ ] **Gemma 4 26B A4B**: does the bundled GGUF chat template round-trip tool calls? If no, try `asf0/gemma4_jinja` via `--chat-template-file`.
- [ ] **Gemma 4 26B A4B**: Q6_K KL vs Q5_K_M on a small sample of our coding-eval prompts — is the 26B's MoE-sensitivity claim visible?
- [ ] **Gemma 4 26B A4B**: do the specific tool-call tokens Gemini cited (`<|tool_call>...<tool_call|>`, `<|"|>` delimiter) actually appear in Google's model card / the bundled jinja, or are they invented?
- [ ] **Gemma 4 31B Q6_K (unsloth)**: SHA256 matches `abd0be03a2bc3f3c9d8e018cbb4ff5b553c340c65d49b6b346c48be5a1efde28` after download (pinning the published file).
- [ ] **Gemma 4 31B**: same template / loop / tool-call checks as 26B.
- [ ] **gpt-oss 120B**: does b9247 contain the #20500 re-fix? Multi-turn tool-call test (Hermes one-shot doesn't expose this directly — need a multi-turn fixture).
- [ ] **gpt-oss 120B**: Vulkan vs ROCm load — confirm Vulkan loads cleanly on b9247; if ROCm 7.2 also loads cleanly, controlled `llama-bench` decode A/B.
- [ ] **gpt-oss 120B**: nonce gate against bundled Harmony template; `--reasoning-format auto`.
- [ ] **All three**: KV cache F16 (Gemma) / q8_0 (gpt-oss) — confirm no degradation vs no-quant on the quality battery.
- [ ] **Lemonade**: is v10.3 / OmniRouter real, or is our existing `b9247` Lemonade build the relevant one?
- [ ] **PR #21066** real and merged? If yes, in which ROCm release line?

## 5. Caveats Both Reports Acknowledge

- Mesa RADV 25.2.8 specifically could not be verified (only RADV-for-gfx1151 generally). Our `audit_host_parity.sh` should report the actual point release.
- localbench 26B A4B exact sub-Q8 quant KL numbers are paywalled.
- Strix Halo Vulkan throughput figures (claimed 339 t/s PP / 49 t/s tg for gpt-oss 120B) are single-source community blog (yifei.sg), not reproducible from compass's research. Closest verified RADV bench is on the smaller gfx1150/890M (~92.6 PP / ~19 tg). **Treat these as not-yet-verified baselines; run our own `llama-bench` on b9247 before treating any number as a target.**
- Gemma `<unused49>` loop bug status is fluid (partially fixed across #21343/#21506/#21697; still reported open for some quant/build combos as of late-May 2026). Verify on our exact b9247.

## 6. Updates Landing in plan.md

I will:

1. Correct the stack-mapping table: `Gemma 4 26B A4B IT` and `Gemma 4 31B IT` (drop "Thinking" — it's a toggle).
2. Replace candidate publisher list with compass-grounded picks (ggml-org for gpt-oss; unsloth as primary for Gemma duo; bartowski as alternate).
3. Pin the Gemma 31B unsloth Q6_K SHA256 as the first verification target.
4. Add KV cache guidance: **F16 for Gemma, q8_0 for gpt-oss** — explicit reversal from any draft that read otherwise.
5. Add "DO NOT" list under Theme Risks: no CPU expert offload on gpt-oss for unified memory; no rocWMMA compile flag for gfx1151; no q8_0 KV on Gemma.
6. Update the gate-plan to reflect: gpt-oss first (highest-confidence win), Gemma 4 31B second (dense, fewer surprises), Gemma 4 26B A4B last (hardest discipline).
7. Add the "Open Verification Items" checklist from §4 above as a tracking list.
8. Add the Divergence Log (§3) as a permanent record so we don't relitigate when this synthesis ages out.

## 7. What's Genuinely Useful From the Gemini Report (after filtering)

Not everything in the Gemini paper is wrong — some sections survive scrutiny and are worth keeping:

- **Lifecycle viability framing** — gpt-oss 120B's Apache-2.0 open-weights status as "perpetual" pinning is a useful framing (compass also makes this point in section G4).
- **Hermes config YAML *shape* directionally aligns** with the way our `qwen36plan` profile is structured (provider: custom, base_url, default model, context_size, chat_template_kwargs) — but the *specific keys* (`API_SERVER_*`) look fabricated; use our existing profile as the structural source instead.
- **Risk matrix axes** (Serviceability, Parser Integration Overhead, Backend Allocation Stability, Lifecycle Viability) are a reasonable framework even if the specific ratings invert compass's ranking.
- **The mention of llama.cpp client-side parser failure** with `ChatLlamaCpp`/LangChain pointing to the Anthropic Messages API rather than OpenAI completions — useful "things to avoid" note even if peripheral to our Hermes path.

Everything else from Gemini should be treated as needing independent verification before adoption.
