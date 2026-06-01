# realdata-eval — Glossary

Plain-language definitions for the vocabulary this project uses. If a
term comes up in discussion or in a doc here and you have to ask "what
is that?", it belongs in this file. Add to it freely.

Each entry: a one-line **plain** definition, an **analogy**, and where
useful a **plant analog** in treatment-operator terms.

---

## Eval machinery

### Probe
**Plain:** One repeatable test you run against the agent — a question
with a known right answer, packaged so you can ask it over and over
while changing one thing at a time.
**Analogy:** A jar test. Known sample in, known target out; re-run with
a different coagulant and compare.
**Plant analog:** Like a standard you run through an analyzer to check
the analyzer, not the water.

### Stub
**Plain:** Fake stand-in data that *we* generate, so we know the
correct answer before the agent ever sees it.
**Analogy:** Capping a pipe and pumping in known test-rig pressure
instead of city water — predictable, so a leak points to the joint,
not a surprise in the supply.
**Plant analog:** A spiked sample with a known concentration: you run
it to prove the method, because you already know what should come out.

### Ground-truth
**Plain:** The correct answer for a probe, computed deterministically
from the data (not opinion). Lives in `truth.json`.
**Analogy:** The answer key the teacher computes before grading the
exam.
**Plant analog:** The certified value on a reference standard's label.

### Rubric / scorer
**Plain:** The code (`score.py`) that compares the agent's answer to
ground-truth within set tolerances and returns pass/fail per check.
**Analogy:** The grading guide that says "within 5 % counts as
correct."
**Plant analog:** The acceptance criteria on a QC check — in range or
out of range.

### Run
**Plain:** One invocation of a probe: this model + this prompt + this
data, on this date. All artifacts captured in one dated folder so two
runs can be diffed.
**Analogy:** One logged jar-test sheet — date, conditions, result.
**Plant analog:** A single round sheet / log entry for one test.

### Tolerance
**Plain:** How close the agent's number must be to ground-truth to
count as correct (e.g. ±5 %).
**Analogy:** The "close enough" band around the bullseye.
**Plant analog:** The allowable deviation on a calibration check.

### Matrix (scoreboard)
**Plain:** The rolled-up table of every run's score across all probes
(`results/matrix.md`). The actual deliverable of the project.
**Analogy:** A league table — who beat whom, at a glance.

---

## Data & formats

### CSV (comma-separated values)
**Plain:** A plain-text table where each line is a row and commas
separate the columns. Opens in any spreadsheet or text editor.
**Analogy:** A printed log sheet, one reading per line, columns lined
up by commas instead of gridlines.
**Plant analog:** A historian export — exactly how SCADA data comes
out when you "export to spreadsheet."

### Parquet
**Plain:** A compressed, column-oriented data file. Same table as a
CSV but smaller and far faster for a program to read selected columns.
**Analogy:** A vacuum-packed, indexed version of the same log sheet —
takes less shelf space and you can flip straight to one column.
**Plant analog:** The difference between a banker's box of paper logs
and the same data indexed in the historian database.

### pandas
**Plain:** The standard Python library for working with tables of data
(rows and columns) in code — load a file, filter, group, compute.
**Analogy:** Excel for programmers. The same things you'd do with a
spreadsheet pivot table, but written as a few lines of code instead of
clicked with a mouse — and it doesn't choke on 450,000 rows.
**Plant analog:** The tool the agent reaches for to crunch a historian
export. When we say "the agent writes code to analyze the data," in
practice that code is almost always pandas. Lives in the agent's
sandbox; if it's not installed there, the agent can't do the analysis
(see Finding #1, devlog 2026-05-30).

### Sandbox (agent execution environment)
**Plain:** The isolated container the agent runs its code in, separate
from the real computer. Here it's a Docker container with Python.
**Analogy:** A workbench in a locked room — the agent can build and
test there without touching anything outside.
**Plant analog:** A bench-scale rig, not the live plant. For the agent
to analyze plant data it needs two things provisioned into that rig:
the data (mounted in) and the tools (pandas installed). Neither is
there by default — provisioning them is a deliberate step. See also
the agent-safety glossary in the public `tesla_agent/reference/`.

### Schema
**Plain:** The structure of a dataset — what columns exist, their
names, their units, their types.
**Analogy:** The blank form's field layout before anyone fills it in.
**Plant analog:** The tag list / point list for a SCADA system.

### Tag
**Plain:** The name of one instrument's data stream (e.g. `LIT101` =
Level Indicating Transmitter, loop 101).
**Analogy:** The label on a gauge.
**Plant analog:** Exactly a SCADA tag — `LIT`, `FIT`, `PIT`, `AIT`,
`P`, `MV` prefixes name the instrument type and loop.

### Historian
**Plain:** The database that records every SCADA tag's value over
time. SWaT is an export from one.
**Analogy:** The plant's flight recorder.
**Plant analog:** Your PI / Wonderware / Ignition historian.

### git-LFS (Large File Storage)
**Plain:** A Git add-on for big files. The repo stores a tiny pointer;
the real bytes live elsewhere and download on demand.
**Analogy:** A library card-catalog card that tells you where the
actual book is shelved — the card isn't the book.
**Note:** Bit us once — a "CSV" that was really a 134-byte LFS pointer.
Fixed by using the LFS-resolving download URL.

### Messy data
**Plain:** Real data with inconsistent names, stray spaces, mixed date
formats, gaps, and units that don't line up — the normal state of
field data.
**Analogy:** Handwritten log sheets from twelve different operators.
**Plant analog:** Pulling six months of rounds from three operators
who each abbreviate "free chlorine" differently. See
**Normalization**.

### Normalization
**Plain:** The step that cleans messy inputs into one consistent
internal form (e.g. mapping `LIT101`, ` LIT-101 `, `lit_101` all to a
single canonical `LIT-101`).
**Analogy:** Transcribing everyone's handwritten sheets onto one
standard form before you add anything up.
**Plant analog:** Standardizing units and tag names before a mass
balance — you can't sum gpm and MGD in the same column.
**Two layers:** *name* normalization (the column is called the same
thing) and *semantic / value* normalization (the values mean the same
thing — same units, same encoding). The second is sneakier: real SWaT
`P-101` uses {1=off, 2=on}, not {0,1}, and `LIT-101` is in mm, not
percent. Matching the name is not enough; the values must match too.

### Integrity check (heuristic / packing-slip check)
**Plain:** A cheap up-front test that the data you loaded is whole and
sane — right row count, right time span, no gaps, values in plausible
ranges — before you trust any analysis built on it.
**Analogy:** Checking the delivery against the packing slip before you
sign for it.
**Plant analog:** Confirming a chemical delivery's volume and
concentration before pumping it into the day tank. A value-range check
("P-101 should be two states, found {1,2} not {0,1}") catches a whole
class of *silent* wrong answers a name check sails past.

### Quarantine (and report)
**Plain:** Setting a small number of bad rows aside (and *saying so*)
instead of either crashing on them or silently keeping them.
**Analogy:** Pulling the obviously-spoiled items from a shipment,
noting how many, and proceeding — but stopping the whole delivery if
half the box is bad.
**Plant analog:** Flagging and excluding a handful of out-of-range
grab samples while logging that you did — but if most samples are
out of range, you stop and investigate the method, not the water.

---

## Future-tech (planned, see plan.md)

### Knowledge graph (KG)
**Plain:** Data stored as a web of things and the relationships between
them — "tag `LIT101` *measures* level *at* stage 1 *feeds* pump
`P101`" — instead of as flat rows.
**Analogy:** A P&ID drawn as a diagram of what connects to what,
versus the same plant described in a flat parts list.
**Plant analog:** A P&ID is essentially a knowledge graph on paper —
nodes (equipment) and edges (pipes, signals). A KG makes that
queryable: "show every instrument upstream of the RO skid."

### Vectorized / embeddings
**Plain:** Turning text or data into lists of numbers that capture
meaning, so a computer can find "similar" items by math.
**Analogy:** Giving every record GPS coordinates in an idea-space —
things about the same topic end up near each other on the map.
**Plant analog:** Lets the agent answer "find logs *like* this fouling
event" without you typing the exact words — it searches by meaning,
not keyword. Useful once we have many runs/logs to search across.

### Embedding model
**Plain:** The model that does the vectorizing — converts a chunk of
text into its coordinate list.
**Analogy:** The surveyor that assigns the GPS coordinates above.

---

## See also

- Main project glossary (hardware / inference / agent-safety terms):
  public `tesla_agent/reference/glossary.md`.
- Sister project taxonomy: [potable
  TAXONOMY.md](https://github.com/boxwrench/potable) — the 16
  operator-reasoning categories every probe is tagged against.
