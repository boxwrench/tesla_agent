# data/

Open-source plant datasets used by the probes in this project.

- **`raw/`** is **gitignored**. Large mirrored files live here.
  Populate with `../scripts/fetch_mirror.sh`.
- **`stubs/`** is **committed**. Small synthetic files we generate
  ourselves with `../scripts/synth_stub.py`. Used when a probe should
  run without depending on network or external mirrors.

## Sources

### SWaT — Secure Water Treatment (iTrust / SUTD)

6-stage scaled-down treatment plant, 11 days of historian + pcap,
41 attack scenarios across 4 days. Used here for **operational
analysis only**; attack labels are not in scope for realdata-eval
probes.

| Mirror | URL | Files | Auth |
|---|---|---|---|
| firmai/random-assets | https://github.com/firmai/random-assets | `SWaT_Dataset_Attack_v0.csv` | none |
| Kaggle (vishala28) | https://www.kaggle.com/datasets/vishala28/swat-dataset-secure-water-treatment-system | Normal + Attack | Kaggle CLI |
| iTrust official | https://itrust.sutd.edu.sg/itrust-labs_datasets/ | full release set | email request |

**Citation requirement (iTrust):** any publication using SWaT must
credit iTrust, SUTD per the dataset access agreement. Honor this in
any README / paper / blog post that derives from realdata-eval work.

Canonical reference: Goh, Adepu, Junejo, Mathur (2016), *A Dataset to
Support Research in the Design of Secure Water Treatment Systems*,
CRITIS 2016, Springer.

### WADI — Water Distribution (planned)

Same lab, distribution-network testbed. Not yet pulled.

### BATADAL — Battle of Attack Detection Algorithms (planned)

Distribution-network attack-detection benchmark. Open download via
https://www.batadal.net/. Not yet pulled.

## Checksums

After running `fetch_mirror.sh`, sha256 sums land in `checksums.txt`
in this directory. Pin them in PRs to make mirror integrity
auditable.
