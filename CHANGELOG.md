# Changelog

All notable public-facing changes to `tesla_agent` are recorded here.

This repo is both a learning guide and a reproducibility reference, so changes
that alter model recommendations, benchmark numbers, install paths, safety
guidance, or web-dashboard behavior should be listed.

## Unreleased

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
