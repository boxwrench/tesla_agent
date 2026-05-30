# Research Synthesis — Round 2 (Targeted Verification)

**Reads on top of:** `research-synthesis.md` (Round 1). This file resolves the
three load-bearing questions and the three nice-to-have questions posed in
`research-prompt-round2.md` against two new reports:

- **Compass round 2** — `compass_artifact_wf-638cd35e-f11f-451a-ad32-76c3d03d8cc5_text_markdown.md`
  — primary-sourced, dated, URL-cited, flags its own unverifiables. Treated
  as authoritative.
- **Gemini round 2** — `Research Request Analysis and Report.md` — same
  divergence pattern as Round 1: mixes real technical specifics with
  prose padding (whole sections on agentic prompting frameworks and
  enterprise asset auditing that are off-topic for this stack), several
  unsourced claims, and at least one cross-PR citation confusion. Treated
  as suspect; technically-specific claims flagged for verification before use.

---

## Action Summary (read this first)

| Decision | Outcome | Authority |
|---|---|---|
| Rebuild llama.cpp Vulkan to >b9247? | **No.** PR #20393 (the OpenAI-path fix for #20500) was merged Mar 18, 2026 and is included in b9247. | Compass primary |
| Route Hermes through `/v1/messages`? | **No.** The Anthropic path was NOT fixed by PR #20393. Stay on `/v1/chat/completions`. | Compass primary |
| Trust the Gemma 4 `<\|tool_call\|>` / `<\|"\|>` template syntax? | **Yes.** It's real, confirmed by Google docs + llama.cpp upstream Jinja. NOT fabricated. | Compass primary, both Google + llama.cpp |
| Use the upstream Gemma 4 Jinja? | **Yes** — `models/templates/google-gemma-4-31B-it-interleaved.jinja` via `--chat-template-file --jinja`. Watch for outdated-template warnings; swap if seen. | Compass primary |
| Pull `second-state/gpt-oss-120b-GGUF`? | **No.** Real publisher but LlamaEdge-oriented. Use `ggml-org/gpt-oss-120b-GGUF` (63.4 GB, 3 shards). | Compass primary |
| Toggle Gemma 4 thinking via `--reasoning off`? | **No.** Use `chat_template_kwargs: {enable_thinking: false}`. Cap via `reasoning_budget`. | Compass primary |
| Ensure ROCm ≥ 7.2.1 on the Lemonade nightly? | **Yes.** The PR #21066 workaround removal depends on the ROCm 7.2.1 upstream fix; below that, you keep the regression. | Compass + Gemini agree |
| Trust the 339 t/s pp / 49 t/s tg Vulkan numbers as a baseline? | **No.** Single-source (Yifei's blog). Expect 40–50 tg in practice. Benchmark our own box. | Compass primary |

---

## Round-2 Question Resolution

### Q1 — gpt-oss #20500 multi-turn fix in b9247? **RESOLVED.**

**Compass:** Issue #20500 was closed by **PR #20393** ("common: rework gpt-oss
parser" by aldehir), merged **Mar 18, 2026**. The PR modifies the shared
`common_chat_params_init_gpt_oss()` which handles `/v1/chat/completions` —
the exact path Hermes uses. Merged ~2 months before b9247 (May 20, 2026),
so it's included.

**Critical caveat:** the PR did NOT touch `tools/server/server-common.cpp`
`convert_anthropic_to_oai()`. The **Anthropic `/v1/messages` path remains
unfixed** for the same bug, even though Issue #20500 is closed.

**Additional caveat:** aldehir self-flagged Mar 19, 2026 (one day after merge)
that the `erase("content")` call is unconditional rather than gated on
`tool_calls`. No follow-up correction PR confirmed.

**Gemini:** also names PR #20393 (cites release "b8405"). The release tag is
plausible if b8405 was its first release tag, but compass doesn't pin a
specific original tag and the b8405 datum is unverified. Either way, b9247
inherits it.

**Action:** No rebuild needed. Stay on `/v1/chat/completions`. If we ever see
a "Cannot pass both content and thinking" 500 on b9247, first thing to capture
is which API path the request hit.

---

### Q2 — Gemma 4 template syntax: real or fabricated? **REAL.**

The earlier Gemini-style synthesis described Gemma 4 boundary tokens that
looked like they could be invented — `<|tool_call>`, `<|"|>` for strings,
`<|tool>declaration:`, `call:` / `response:` prefixes. Round-2 compass
verifies all of these against **two** primary sources:

1. **Google's official prompt-formatting docs** at `ai.google.dev/gemma/docs/core/prompt-formatting-gemma4`
2. **llama.cpp upstream Jinja**:
   `models/templates/google-gemma-4-31B-it-interleaved.jinja`

Verbatim confirmations:
- Turn boundaries are **asymmetric**: opening `<|turn>`, closing `<turn|>` —
  NOT `<|turn|>` on both ends.
- String delimiter `<|"|>` is real, e.g. `<|"|>London<|"|>`.
- Reasoning channel marker is `<|channel>thought ... <channel|>` — NOT
  Harmony-style `<|channel|>thought<|message|>...<|end|>`. Asymmetric again.
- System turn opens with `<|think|>` when thinking is enabled.

**Action:** Use the upstream Jinja via `--chat-template-file --jinja`. Don't
hand-roll. Watch for two known issues:
- `<|channel>thought` markers occasionally leak into visible output → swap to
  a more recent template file
- "outdated gemma4 chat template" warning on older GGUFs → pull updated weights

**Gemma 4 thinking control** (compass, verbatim):
- `chat_template_kwargs: {enable_thinking: false}` — deterministic OFF
- `chat_template_kwargs: {reasoning_budget: 4096}` — cap (community-attributed
  to PR #21697; treat PR number as unverified)
- NOT `--reasoning off` (that's gpt-oss style)
- Behavioral wrinkle: large Gemma 4 (26B/31B) **may still emit a thought channel
  even with thinking disabled** — observed leakage, requires post-hoc filter

---

### Q3 — `second-state/gpt-oss-120b-GGUF` real? **YES but not the right pick.**

The repo exists. "Second State" is the WasmEdge/LlamaEdge org — a credible
ecosystem publisher with a deep catalog (Qwen3, Phi-4, Gemma family, etc.).
Their GGUFs are documented with `wasmedge` + `llama-api-server.wasm`
invocations and a `--prompt-template` flag.

**But:** for our Strix Halo + b9247 Vulkan + llama.cpp stack, `ggml-org/gpt-oss-120b-GGUF`
is the canonical choice:
- Maintained by the llama.cpp project itself
- **63.4 GB total** in 3 shards (00001 = 13 MB metadata, 00002 = 31.7 GB, 00003 = 31.6 GB)
- Filename pattern: `gpt-oss-120b-mxfp4-00001-of-00003.gguf` (lowercase)
- Keeps attention/embedding/output at Q8_0; MoE experts at MXFP4
- Used in the official llama.cpp gpt-oss guide (Discussion #15396); 371K downloads/month

**Action:** Pull `ggml-org/gpt-oss-120b-GGUF`. Round-2 confirms the filename
pattern — update `plan.md` if it says otherwise.

---

### Q4 — Lemonade v10.3 / OmniRouter real? **YES, with three changes to note.**

- v10.3.0 shipped **Apr 28, 2026**; series now at **v10.6.0** as of late May 2026
- OmniRouter is real, added in v10.3 via PR #1559. Unifies llama.cpp,
  stable-diffusion.cpp, Kokoros, whisper.cpp behind one OpenAI-compat endpoint.
- v10.6 rebranded "OmniRouter" → "Lemonade Omni" (PR #1973)
- Three migration changes:
  1. Electron → Tauri (≈10× smaller installer)
  2. `lemonade-server.service` → **`lemond.service`** (Debian rename)
  3. **Default ROCm channel changed from `nightly` → `preview` (7.12)** — if
     we want to stay on nightly, pin it explicitly

**Action:** Not pressing. If we upgrade Lemonade, expect the service rename
and pin the ROCm channel explicitly.

---

### Q5 — PR #21066 real? **REAL but mischaracterized by Gemini.**

It's "[HIP] Bump ROCm version to 7.2.1," shipped in **b8642 (Apr 3, 2026)**.
A version bump that **removes** an LLVM workaround llama.cpp had been carrying
for the ROCm 7.2 perf regression (tracked as `ROCm/rocm-systems#2865`),
because ROCm 7.2.1 fixed the regression upstream.

- It is NOT a "ROCm LLVM Shared Memory Optimization" written into llama.cpp
- The "2–3× speedup" framing is unsubstantiated
- The fix is in b9247 (b8642 is older)
- **But** the fix only takes effect on **ROCm ≥ 7.2.1**

The Gemini paper's longer story about LLVM patch `llvm/llvm-project#147700`,
VGPR spills, and the `-mllvm` override flag is more technically specific than
compass and *plausibly true* (the underlying ROCm regression is real), but
the framing as "PR #21066 yields 2-3× speedup" conflates two things. The PR
just removes the workaround; the speedup depends on ROCm version.

**Action:** Verify our Lemonade nightly is ROCm ≥ 7.2.1 before we treat the
gpt-oss-120b numbers as representative. `rocminfo | grep -i version` at probe time.

---

### Q6 — 339 t/s pp / 49 t/s tg Vulkan reproducible? **NO. Single-source.**

- Source is **Yifei's blog** (blog.yifei.sg) using RADV GFX1151 KHR_coopmat with
  `-ngl 999 -t 8 -pg 2048,128 -b 4096 -ub 256 -fa 1`
- **No independent reproduction on gfx1151** found
- The closest widely-cited number in llama.cpp Discussion #15396 is on
  **gfx1150** (Radeon 890M), not gfx1151: ~92 t/s pp2048, ~19 t/s tg128
- gfx1151 community guidance is "~40–50 tg t/s and a few-hundred pp t/s" with
  RADV coopmat

**Action:** Treat 339/49 as a directional upper bound, not a target.
Run `llama-bench -ngl 999 -fa 1 -b 4096 -ub 256` on our own box at gate time.

---

## What's Useful From the Gemini Paper (After Filtering)

The Gemini paper is mostly long-form prose framed for an enterprise audience.
The agentic-prompting-framework section, the Five Pillars list, and the
"Enterprise Investment and Asset Auditing Matrices" table are unrelated to
this stack and should be ignored.

**However**, it surfaced four technically-specific claims worth recording
even though they're suspect-grade — they're either flagged for verification
or kept as a watch list:

1. **MUL_MAT_ID is the dominant prefill bottleneck for large MoE on gfx1151 Vulkan.**
   Cites llama.cpp Issue #21948 (compass did not cover this; the issue number
   reads plausible). Claims "ROCm MMQ VGPR tuning #21344 improves prefill 19–35%
   over Vulkan" — this is the **interesting actionable claim** if true: for
   gpt-oss-120b on gfx1151, prefill might be substantially faster on a properly-
   built ROCm/HIP llama.cpp than on RADV Vulkan, inverting the current advice.
   **Verify before acting** — check Issue #21948 and PR #21344 on github.com/ggml-org/llama.cpp.

2. **Gemma 4 + Vulkan + `-ctk turbo3 -ctv turbo3` → immediate gibberish.**
   Block-sizing mismatch between WHT-rotated KV kernels (128/256) and Gemma 4
   global-layer tiles (512). This is a concrete anti-pattern: **don't use
   turbo3 KV quantization on Gemma 4 over Vulkan.** Aligns with our existing
   "F16 KV for Gemma" plan, so this just reinforces the decision.

3. **RADV exposes 65,536 bytes shared memory vs AMDVLK 32,768 bytes.**
   Specific number, plausible — already in our "use RADV not AMDVLK" baseline
   but the magnitude (2×) explains why.

4. **Gemma 4 context-saturation drift.** Claims long context degrades
   system-prompt attention, leading to tool-call refusals deep in conversations.
   Sourced to a Reddit post (`/r/LocalLLaMA/comments/1sh1bwv`); not a primary
   source. **Watch for at gate time** — if our Gemma 4 nonce holds early but
   the coding eval degrades over multi-step conversations, this is a candidate
   explanation.

5. **`<|channel|>thought\n*` (with literal asterisk) may be needed to activate
   thinking on Gemma 4.** SFT statistical-dependency claim. Compass doesn't
   corroborate. **Treat as folklore, not as a configuration to ship.**

---

## Updates Landing in `plan.md` after this synthesis

- gpt-oss model pull path stays `ggml-org/gpt-oss-120b-GGUF`, filename pattern
  lowercase `gpt-oss-120b-mxfp4-0000{1..3}-of-00003.gguf`
- Add Hermes routing constraint: **OpenAI `/v1/chat/completions` only**; do not
  expose `/v1/messages` to multi-turn tool-call traffic on b9247
- Gemma 4 thinking control: `chat_template_kwargs: {enable_thinking: false}`,
  cap with `reasoning_budget`
- Anti-pattern addition: **never use `-ctk turbo3 -ctv turbo3` with Gemma 4 on
  Vulkan** (immediate gibberish per Gemini paper, plausible mechanism)
- Pre-gate sanity check: `rocminfo | grep -i version` confirms ROCm ≥ 7.2.1
- Watch list: Issue #21948 (MUL_MAT_ID prefill bottleneck), Reddit thread on
  Gemma 4 context drift

## Open from Round 2 (worth resolving but non-blocking)

- Exact merge SHA of PR #20393 onto master (compass flagged this UNVERIFIED;
  can be checked by `git log` against `ggerganov/llama.cpp` if we clone)
- PR #21697 reasoning-budget fix for Gemma 4 (community-attributed, unverified)
- second-state's exact 3-shard filename pattern (only the single-file
  `gpt-oss-120b-MXFP4_MOE.gguf` is confirmed on the card)
- Issue #21948 + PR #21344 ROCm MMQ VGPR tuning — verify before claiming
  ROCm prefill advantage over Vulkan for MoE
