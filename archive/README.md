# Archive Notes

This directory records preservation points for public mirror sync work.

## 2026-06-03 — Pre Public-Sync Dirty State

Before continuing the public mirror alignment pass, the existing dirty working
tree was preserved as a named git stash:

```text
stash message: archive/public-sync-pre-2026-06-03
stash hash:    d9b1e6df605924b4a3d051d2863d86bf91be3b6c
base HEAD:     7df1f0fc099dfff24cd4f257b853405d8f6fbbae
branch:        main
remote:        origin/main
```

The stash was immediately re-applied, so the working tree remained unchanged.

Files covered by that stash:

```text
README.md
docs/app.js
docs/guide/07-choosing-a-model.md
docs/guide/08-speed-and-tuning.md
docs/index.html
eval/realdata-eval/devlog.md
guide/07-choosing-a-model.md
guide/08-speed-and-tuning.md
reference/README.md
reference/decision-tree.md
reference/reproducibility-matrix.md
research/README.md
research/gemma-4-26b-control-vs-mtp-strix-halo.md
```

Recover with:

```bash
git stash show --stat d9b1e6df605924b4a3d051d2863d86bf91be3b6c
git stash apply d9b1e6df605924b4a3d051d2863d86bf91be3b6c
```
