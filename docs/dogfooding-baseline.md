# Dogfooding Baseline

## Snapshot

- observed_at: `2026-07-15`
- checkout: `hyohyeon-harness`
- governance writer: `intent` CLI only
- operational records: three governed Intents, four Runs, approved Plan/Contract chains, verification logs, completion journals, and one Wiki decision article

This is the first checked-in operational baseline for the repository's self-dogfooding. It separates evidence that the workflow was actually exercised from the weaker fact that hooks and an empty `.intent/` skeleton are installed.

## Observed Work

| Intent | Governed Run | Outcome | What was exercised |
| --- | --- | --- | --- |
| `INT-001` | `RUN-001` | `passing/done` | autonomous readiness transitions, implementation, fresh verification, learning, completion journal |
| `INT-002` | `RUN-003` | `passing/done` | autonomous product-policy and adapter documentation synchronization |
| `INT-003` | `RUN-004` | active at snapshot | root-containment hardening, high-ID compatibility, concurrent Run/Trace updates, Contract semantics, verification, Wiki capture |

`RUN-002` remains `paused` as preserved operational evidence of two agents initially opening work for `INT-002`; `RUN-003` became that Intent's governed completed Run. The history is not rewritten to make the workflow look cleaner than it was.

The CLI-created Wiki article `governance-integrity-hardening` records the design decisions from `INT-003`; the `operating-baseline` overview links to it. Their index and log were rebuilt through `intent wiki`, not by editing `.intent/` directly.

## What This Evidence Supports

- An agent can create and approve Intent, Plan, and Contract artifacts without a person entering governance commands.
- Scope, lineage, phase, DoD, learning, and fresh-evidence gates remain active after that authority change.
- Run, trace, raw verification, completion-transaction, and Wiki artifacts are produced by real repository work rather than setup alone.
- Friction such as a superseded paused Run remains visible for later workflow tuning.

## What It Does Not Prove

- Three self-referential Intents are too small and too correlated a sample to estimate detection precision or false-positive rate.
- No real-world Detection → Judge → Rule → Eval recurrence has accumulated yet.
- A single day of Wiki history cannot demonstrate long-term knowledge compounding or retrieval quality.
- Cross-process safety is regression-tested with concurrent workers, but broad multi-agent operational history is still limited.

## Next Sampling Target

Complete at least three to five additional, independent feature or fix Intents through the full chain. Include one failed verification/rework loop, one confirmed-or-dismissed Detection, and one later task that reuses an earlier Wiki decision. For each run, record command retries, blocked reasons, evidence freshness failures, detection dispositions, and Wiki reuse. Only then should the project make quantitative claims about friction, detection precision, or knowledge compounding.
