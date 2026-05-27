# Chapter 10: How Agents Work Together

So far we have talked about *one* agent: a single model, with tools and a goal, working through a task in a loop. That is plenty for many jobs. But once you start handing real work to agents, you run into the same question every plant manager already knows the answer to:

> *Do I put one person on this, run an assembly line, or assign a crew with a supervisor?*

You would never staff a treatment plant with one operator doing every task end to end, and you would never throw ten people at a job that has to be done in strict order. The same judgment applies to agents. This chapter gives you the three basic shapes — **one agent, a sequential pipeline, and an orchestrator with a crew** — and a simple rule for choosing between them.

No new software is required to understand this. These are *patterns* for arranging the agent you already have.

---

## 1. One Agent (The Solo Operator)

The simplest setup. One model, one conversation, working a task from start to finish.

```
   YOU ──► [ Agent ] ──► Result
              │
        reads files,
        runs scripts,
        checks its work
```

**Use it when** the job is self-contained and fits in one train of thought.

*Water example:* "Read this month's bench-test spreadsheet and draft a one-page summary of the jar-test results." One file in, one document out. A solo operator is exactly right — adding more agents would just add overhead.

The limit shows up when the job gets big or repetitive. A single operator doing fifty separate jobs back-to-back is slow, and a single operator juggling one job with ten tangled steps starts dropping details. That is where the other two shapes come in.

---

## 2. The Sequential Pipeline (The Assembly Line)

Here, several agent steps run **in order**, and each step hands its result to the next. The output of step one becomes the input to step two.

```
   YOU ──► [ Step 1 ] ──► [ Step 2 ] ──► [ Step 3 ] ──► Result
            gather         compare        draft
              │              │              │
           findings ───► comparison ───► final brief
```

The defining feature is **carried-forward state**: step three needs what steps one and two produced. The order is not optional.

**Use it when** the steps *depend on each other* — when you genuinely cannot do step three until step two is done.

*Water example:* a small research workflow. **Step 1:** gather what's known about three coagulant options. **Step 2:** compare them on dose range, sludge production, and handling. **Step 3:** draft a short recommendation brief. You can't write the recommendation before you've done the comparison, and you can't compare before you've gathered. That dependency is what makes it a pipeline.

> **Why not just use one big agent?** You can — and for three steps, often should. The pipeline shape earns its keep when the steps are long or distinct enough that you want each one focused, checkable, and re-runnable on its own without redoing the whole chain.

---

## 3. Batch / Parallel (Many Hands, Separate Jobs)

Sometimes you don't have one job with ordered steps — you have **the same job repeated over many inputs**, and the inputs have nothing to do with each other.

```
            ┌► [ Agent ] ──► Summary 1
   YOU ─────┼► [ Agent ] ──► Summary 2
   (40       ├► [ Agent ] ──► Summary 3
   manuals)  └► [ Agent ] ──► ...  Summary 40
```

The defining feature is **independence**: no step needs any other step's result. Summary #7 doesn't care what happened to summary #12.

**Use it when** you have *volume* and the items are independent.

*Water example:* "Summarize the operating-and-maintenance section of each of these forty equipment manuals into a one-paragraph cheat sheet." Each manual stands alone. There's no order, no carried state — just the same task, forty times.

> **An honest hardware note.** On one local workstation you do **not** get true simultaneous parallelism. There is a single chip and a shared memory pool (you'll recognize this constraint from Chapter 03 — the whole machine shares one memory bus). So "batch" here usually means **queue and process one after another**, not literally at the same time. That's fine: the value of this pattern isn't doing things in the same instant — it's that you've recognized the work is *independent*, which keeps each run small, simple, and easy to retry if one fails. True simultaneous parallelism is a benefit of cloud fleets with many chips; on a local box, batch is about clean decomposition.

---

## 4. The Orchestrator (The Shift Supervisor)

The most capable shape. A coordinating agent — the **orchestrator** — takes a big, multi-part goal, breaks it into pieces, hands each piece to a worker agent, and then assembles the pieces into a finished result.

```
                       ┌──────────────────────┐
   YOU ──► big goal ──►│     ORCHESTRATOR      │
                       │  plans + delegates +  │
                       │      assembles        │
                       └───┬────────┬───────┬──┘
                           ▼        ▼       ▼
                      [Worker A][Worker B][Worker C]
                       options   test     bench
                       gathered  matrix   timeline
                           └────────┼───────┘
                                    ▼
                            Orchestrator combines
                              into final plan
```

This is the shift supervisor: they don't personally do every task, they decide *what the tasks are*, assign them, and put the results together. The workers can be solo agents, pipelines, or even batches.

**Use it when** the goal is large and has *several distinct parts* that a single train of thought would struggle to hold all at once.

*Water example:* "Put together a draft plan for a coagulant pilot study." The orchestrator splits this into parts: one worker gathers candidate coagulants and typical dose ranges, another drafts a test matrix (which jars, which doses, which raw-water conditions), another sketches a rough bench timeline and equipment list. The orchestrator then weaves the three into a single coherent draft plan for an engineer to review.

> **Orchestrator vs. pipeline — what's the difference?** A pipeline is a fixed assembly line *you* laid out in advance. An orchestrator *decides* how to split the work and can run independent pieces as a batch. Pipeline = known steps in known order. Orchestrator = a coordinator figuring out the pieces and pulling them together.

---

## 5. How to Choose

You don't need to memorize the patterns — just answer one question about your task:

```
   Is it one self-contained job?  ───────────────►  ONE AGENT
   Do the steps depend on each other, in order? ──►  SEQUENTIAL PIPELINE
   Is it the same job over many independent items? ►  BATCH
   Is it a big goal with several distinct parts? ──►  ORCHESTRATOR
```

A quick reference:

| Pattern | Defining trait | Water example |
|---|---|---|
| **One agent** | Self-contained | Summarize one bench-test sheet |
| **Sequential pipeline** | Steps depend on order | Gather → compare → recommend coagulants |
| **Batch** | Independent, repeated | Summarize 40 equipment manuals |
| **Orchestrator** | Big goal, many parts | Draft a full pilot-study plan |

The most common mistake newcomers make is reaching for one big agent for *everything*. Naming these shapes lets you match the arrangement to the job — which usually means a simpler, faster, more reliable result.

---

## 6. Where This Fits in Water Work

Agents are useful anywhere you have text, documents, logs, or data that someone has to read, organize, compare, or draft. A few practical, everyday examples from utilities and technical R&D:

* **Operations knowledge capture** — turn a retiring operator's loose notes or a recorded walkthrough into a structured reference. *(Orchestrator: one worker per system — intake, filtration, chemical feed.)*
* **Maintenance log triage** — sort and summarize a backlog of work-order notes to spot recurring equipment issues. *(Batch: each log entry is independent.)*
* **R&D literature reviews** — gather and compare what's published on a treatment approach before scoping a study. *(Sequential: gather → compare → summarize.)*
* **Treatment-option comparison** — line up alternatives (e.g., GAC vs. ion exchange) on the factors that matter to your system. *(Sequential or orchestrator.)*
* **Onboarding and training material** — draft plain-language explainers from dense technical manuals for new operators. *(Batch: one explainer per topic.)*
* **Internal runbook drafting** — turn "how we actually do this" tribal knowledge into a written procedure your team can follow. *(One agent or pipeline.)*
* **Vendor proposal comparison** — pull the key terms from several vendor responses into one side-by-side table. *(Batch to extract, then one agent to combine.)*
* **Meeting notes to action items** — convert rambling notes into a clear, owned task list. *(One agent.)*

Notice the common thread: these are about **organizing, comparing, drafting, and capturing knowledge** — turning work people find tedious into a reviewable first draft. A human always reviews the output; the agent gets you to the 80% draft faster.

> **A note on scope.** This guide deliberately focuses on operational, engineering, and knowledge-management work — not regulatory, compliance, or reporting tasks. Anything that carries legal or permitting weight belongs with the qualified humans who own that responsibility; an agent's job here is to save time on the everyday drafting and organizing around it, not to make the calls.

---

As your agent work grows, reliability matters more than cleverness — a crew is only as good as its ability to do the job the same way every time. Chapter 06 (Verification) showed how to *test* that an agent does what you expect; revisit it once you start chaining agents together, because every shape in this chapter is only as trustworthy as the single agents it's built from.
