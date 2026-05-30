# Handoff Notes

## Current Repo State

This repository is the public-facing `tesla_agent` guide for setting up local agentic AI workflows on AMD Strix Halo (`gfx1151`) hardware, with a utility/water-operations audience.

The current published docs still recommend the Qwen-centered stack:

- Default workhorse: Qwen 3.6 35B MoE on Vulkan/RADV.
- ROCm path retained as fallback.
- Qwen 3.5 122B MoE used as quality escalation.
- Qwen 3.6 27B Dense treated as experimental/break-glass.

Recent small updates already pushed to `main`:

- `3754360` - Fix setup success text contrast.
- `0d76b4c` - Add Title22 blog link.

## Benchmark Pivot Status

This branch is implementing the 2026-05-30 benchmark pivot from the private source repo into public-safe language:

- Gemma 4 and GPT-OSS 120B perform better across the tested local agentic workflows.
- Qwen models should remain documented and available.
- The docs should acknowledge that online/community consensus often favors Qwen reasoning, especially Qwen 3.6 27B, but local benchmarks and actual use cases matter.
- The recommendation should pivot to the new stack with that caveat, rather than deleting or dismissing Qwen.

Suggested framing:

> Qwen remains a strong reasoning family and a credible alternative, but this guide's default recommendations follow measured local Strix Halo agent-workflow results. Based on the newest benchmarks, Gemma 4 and GPT-OSS 120B become the primary recommended options, while Qwen remains available for workflows where its reasoning style or compatibility is preferred.

## Data Shape Used

Benchmark data is represented in public docs using this shape:

```text
Model:
Quant/file:
Backend:
RAM footprint:
Context window:
Reasoning/think setting:
Decode tok/s:
Prefill tok/s if available:
Nonce Gate result:
Coding eval result:
Planning quality score:
Recommended role:
Important caveats:
```

Key recommendation decisions to make:

- Default agent/workflow model: Gemma 4 or GPT-OSS 120B?
- Quality escalation model: Gemma 4, GPT-OSS 120B, or another route?
- Qwen role: reasoning alternative, compatibility fallback, legacy/default alternative, or research comparison?
- Should setup scripts default to the new model, or should only the docs/model finder change first?
- Are there model-specific server flags, chat-template parameters, context limits, or backend constraints?

## Files Likely To Update

Core repo docs:

- `README.md`
- `reference/README.md`
- `reference/reproducibility-matrix.md`
- `reference/decision-tree.md`

Guide chapters:

- `guide/04-the-journey.md`
- `guide/07-choosing-a-model.md`
- `guide/08-speed-and-tuning.md`
- Possibly `guide/05-setup.md` if defaults or download commands change.

GitHub Pages mirror:

- `docs/index.html`
- `docs/app.js`
- `docs/guide/*.md` mirrors for any changed `guide/*.md` files.
- Interactive Setup must be reviewed because default model download commands, serving commands, success logs, and explanatory text may need to change.
- Model Finder must be updated, not just the Markdown benchmark tables.
- Benchmark chart data in `docs/app.js` must reflect the new model ladder.
- The hosted website should link clearly to `reference/reproducibility-matrix.md` / "Reproducibility Matrix & Technical Deep-Dive" from the main repo.
- Glossary entries should be added for any new model families, serving concepts, benchmark concepts, or architecture terms introduced by Gemma 4 / GPT-OSS 120B.

Scripts/config if defaults change:

- `scripts/config.env.example`
- `scripts/serving/serve_rocm.sh`
- `scripts/serving/serve_vulkan.sh`
- `scripts/serving/create_hermes_profile.sh`

## Implementation Notes

- Keep the critical-infrastructure warning intact.
- Preserve the public/educational tone for water and utility professionals.
- Avoid overstating model superiority. Use measured phrases like "recommended for this benchmarked workflow" and "community consensus may differ."
- If `guide/*.md` changes, mirror the same content into `docs/guide/*.md`.
- The hosted page embeds model recommendations in `docs/app.js`; updating Markdown alone will not update the interactive Model Finder or chart.
