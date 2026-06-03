# Repository Map and Canonical Sources

This repo serves humans reading in order and machines trying to locate the
authoritative copy of a fact. Prefer stable paths over clever folder moves.

## Canonical Source Policy

When a fact appears in more than one place, update the canonical source first,
then mirror the summary copy.

| Fact type | Canonical source | Summary / mirror surfaces |
|---|---|---|
| Reading order and learner path | `README.md` and `guide/` | `docs/index.html`, `docs/guide/` |
| Benchmark numbers, model files, checksums, backend pins | `reference/reproducibility-matrix.md` | `README.md`, `reference/README.md`, `guide/07-choosing-a-model.md`, `guide/08-speed-and-tuning.md`, `docs/index.html`, `docs/app.js` |
| Quick technical lookup tables | `reference/README.md` | `README.md`, dashboard tables |
| Model-selection logic | `reference/decision-tree.md` | README model matrix, dashboard model finder |
| Long-form benchmark interpretation | `research/` | README notes, guide chapters |
| Runnable evaluation evidence | `eval/` | README real-data section, research writeups |
| Public release/history notes | `CHANGELOG.md` | README short links |
| GitHub Pages rendered site | `docs/` | N/A; generated/maintained mirror for web readers |
| Preservation notes for old working states | `archive/` | Changelog entry only |

## Folder Roles

| Path | Role | Human use | Machine use |
|---|---|---|---|
| `README.md` | Front door | Start here; explains audience, safety, model ladder, and reading order. | High-level summary only; do not treat benchmark tables as canonical when they conflict with `reference/`. |
| `guide/` | Teaching guide | Read numbered chapters in order. | Stable markdown source for guide content. |
| `docs/` | GitHub Pages site | Open `docs/index.html` locally or use the hosted site. | Web mirror; keep paths stable so GitHub Pages links do not break. |
| `reference/` | Technical reference | Look up exact versions, checksums, speed rows, and model-routing rules. | Primary machine-ingestion target for benchmark/reference facts. |
| `research/` | Long-form analysis | Read case studies, failed paths, and interpretation. | Context source, not the canonical benchmark table. |
| `eval/` | Evidence and probes | Audit how claims were tested. | Runnable/scorable artifacts and captured results. |
| `scripts/` | Portable utilities | Setup, serving, and verification helpers. | Side-effect boundary for reproducible commands. |
| `assets/` | Static images for markdown | Diagrams and charts used in docs. | Binary assets referenced by markdown. |
| `archive/` | Preservation notes | Recover old pre-sync states if needed. | Metadata only; do not use as active source. |

## Update Rules

1. Do not move public paths under `guide/`, `docs/`, `reference/`, `research/`,
   or `eval/` without adding redirects or updating all links in the same change.
2. Do not edit dashboard benchmark numbers directly without first updating
   `reference/reproducibility-matrix.md`.
3. Keep `guide/` and `docs/guide/` synchronized when guide chapters change.
4. Put new measured benchmark rows in `reference/reproducibility-matrix.md`.
5. Put narrative explanation of why a result matters in `research/`.
6. Put user-facing recommendation changes in `CHANGELOG.md`.

## Quick Navigation

- New reader: `README.md` -> `guide/01-what-is-agentic-ai.md`
- Reproducer: `reference/reproducibility-matrix.md`
- Model chooser: `reference/decision-tree.md`
- Safety reviewer: `guide/11-agent-safety.md`
- Evidence auditor: `eval/`
- Web/dashboard maintainer: `docs/`
