# Probe: ph-control

| | |
|---|---|
| **potable_category** | `disinfection_and_chemical_dosing` |
| **Status** | scaffolded; stub + real truth built, scorer verified; no agent runs yet |
| **Created** | 2026-06-01 |

## What it tests

Whether the agent can characterize a **chemical-dosing control loop** from raw
historian data: establish the normal pH operating band *from the data*, judge
whether the loop is in control, distinguish a sustained loss of control from a
brief transient, and connect any excursion to the acid dosing actuator.

This is the campaign's third equipment/physics type, by design:

- pump-cycling → **event detection** (a discrete fault in a duty cycle)
- membrane-fouling → **trend fitting** (a slow degradation slope)
- **ph-control → control-loop tracking** (does the controlled variable hold its
  band against the actuator)

It is also the operator-auditable probe: pH / disinfection chemistry is core
drinking-water-operator knowledge, so a domain expert can sanity-check the
agent's reasoning directly rather than taking the math on faith.

## Inputs

| Item | Path |
|---|---|
| Stub data (committed, deterministic, seed 44) | `../../data/stubs/ph_control_v1.parquet` |
| Stub generator | `../../scripts/synth_ph_stub.py` |
| Real SWaT slice (gitignored) | `../../data/real_slices/ph_control_real_v1.parquet` |
| Normalizer / integrity (shared) | `../pump-cycling/load.py`, `integrity.py` |
| Canonical prompt | `prompt.md` |
| Ground-truth (stub) / real | `truth.json` / `truth.real.json` (regenerable) |
| Real-path override | `data_paths.sh` |

## The seeded condition (stub)

`AIT-202` is held near pH 7.55 by pulsing the `P-203` acid pump. Partway through
the week the pump **sticks ON** (a stuck-actuator failure), over-doses, and pH
crashes to ~5.6 and stays there ~4 hours before recovering — a clear, sustained
**control fault**. Truth: `control_fault_detected = true`.

## The real condition

A 12 h SWaT slice where pH is tightly held near **8.4** (the plant runs alkaline)
with one ~3-minute dip to pH 6.0 (the acid pump drops out and recovers). The
data-driven operating band is ~[8.07, 8.67]. Two things are tested at once:

- **Textbook-band trap** (INSIGHTS #6): an agent that judges normal operation
  against a fixed [6.5, 8.5] band would over-flag the alkaline 8.4 baseline. The
  band must be derived from the data. (The agent passed this — it never flagged
  8.4.)
- **Acute vs sustained** (INSIGHTS #10): the 3-minute dip to pH 6.0 is *not* a
  sustained loss of control, but it **is** an acute breach of a fixed
  water-quality limit (pH < 6.5). Per operator ruling (2026-06-01) that counts:
  truth `control_fault_detected = true`, triggered by `acute_breach`. The agent
  flagged it `true` with sound root-cause reasoning → agent and truth agree.

The fault gate fires on **either** a sustained drift beyond the data-driven band
**or** an acute breach of fixed limits [6.5, 9.0] — see `build_truth.py`.

## Scoring

`score.py` grades `answers.json` vs `truth.json`:

- **GATING** (PASS/FAIL): `ph_mean` (±5% rel), `control_fault_detected` (exact).
- **INFORMATIONAL** (reported, non-failing): `ph_min`, `ph_max`, `dosing_duty_pct`.

The operating band is **data-driven** in truth (median ± max(3·MAD-sigma, 0.3));
a control fault requires a **sustained** (≥30 min) and **material** (≥0.5 pH
beyond band) excursion — parallel to the membrane significance gate.

## Regenerate ground-truth

```bash
python build_truth.py                                            # stub
python build_truth.py --data ../../data/real_slices/ph_control_real_v1.parquet \
                      --out truth.real.json                      # real
```

## Sister project tag

`potable_category = disinfection_and_chemical_dosing` links this probe to
[potable](https://github.com/boxwrench/potable): a failure here points at a gap
in potable's disinfection-reasoning coverage.
