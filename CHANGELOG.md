# Changelog

All notable public-facing changes to `tesla_agent` are recorded here.

This repo is both a learning guide and a reproducibility reference, so changes
that alter model recommendations, benchmark numbers, install paths, safety
guidance, or web-dashboard behavior should be listed.

## Unreleased

### Dashboard

- Replaced "Local Speed Per Coding Point" chart with a **Sequential Task Wall
  Time** chart (1150-token prompt / 2000-token response, lower = faster).
  Solid bars are directly measured via `full_bench.sh`; faded bars are
  estimates using the same `1150/pp + 2000/tg` formula from speed data.
- Added fresh `full_bench.sh` wall-time measurements for Gemma 4 26B-A4B MTP
  block 3 (42.0 s) and Gemma 4 31B IT MTP block 3 (129.3 s).

### Eval Harness Fixes

- `score.py` (all three probes): changed `is` to `==` for boolean gating
  checks so integer answers (e.g. `1`/`0` instead of `true`/`false`) grade
  correctly; replaced bare `open()` calls with `with open()` to ensure output
  files are fully flushed before `sys.exit()`.
- `run_probe.sh`, `selftest.sh`: added `-e` to `set` flags so command failures
  abort the script rather than silently continuing.
- `fetch_mirror.sh`: removed `2>/dev/null` from the checksum step and added a
  warning when the manifest is empty, so a missing `sha256sum` is visible
  rather than silently producing an empty file.

### Public Mirror Sync

- Clarified the public repo's four jobs: learning guide, benchmark-data
  repository, reproducibility/install reference, and supervised water-agent
  starting point.
- Aligned Qwen 3.6 35B MTP speed-lane language across README, guide chapters,
  reference docs, research notes, and the web dashboard.
- Credited the community `strix-halo-guide` for surfacing the Qwen 35B native
  MTP lead, while documenting this repo's independent reproduction and quality
  gating.
- Corrected Qwen 35B MTP artifact sizes:
  - MXFP4-MTP: `19.3 GB`
  - Q4_K_M-MTP: `20.7 GB`
- Kept Qwen 35B MTP as an opt-in speed lane, not the default setup path.
- Promoted Gemma 4 26B-A4B from queued/unverified language to verified
  plain-control baseline language where applicable.
- Added/linked the Gemma 4 26B-A4B control-vs-MTP benchmark note.
- Added archive note for the pre-sync dirty state:
  `archive/public-sync-pre-2026-06-03`.
- Added `REPO_MAP.md` to make canonical sources explicit for humans and
  machine agents without changing public dashboard paths.
- Updated the public performance matrix with private-repo verified rows for
  Qwen 122B MTP tuning, StepFun Step-3.7-Flash MTP/plain, and Qwen3-Coder-Next
  Vulkan b9360.
- Updated the dashboard recommender and visual analysis with local speed rows
  plus credited external intelligence/coding scores from Artificial Analysis
  where available; StepFun coding proxy is labeled as StepFun-published rather
  than AA Coding Index.

### Benchmark Framing

- Reaffirmed `reference/reproducibility-matrix.md` as the canonical public
  benchmark source of truth.
- Clarified that public speed tables are routing aids, not universal model
  leaderboards.
- Preserved the critical-infrastructure and agent-safety warnings.

## 2026-06-03

### Documentation

- Expanded the local LLM glossary.
- Added MTP speed lanes and community credit.

## 2026-05-30

### Benchmark Pivot

- Published the realdata-eval field guide and auditable evaluation bundle.
- Added the "Does It Actually Work on Real Plant Data?" README section.
- Corrected Gemma 31B speed attribution and dense-model speed framing.
