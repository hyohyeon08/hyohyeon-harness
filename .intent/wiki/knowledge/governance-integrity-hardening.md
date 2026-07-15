---
title: Governance Integrity Hardening
type: decision
tags: []
summary: Root containment, high sequential IDs, and concurrent state append are enforced invariants.
created: 2026-07-15
updated: 2026-07-15
---

# Governance Integrity Hardening

Decision: scope targets must be repository-relative before any filesystem read. Absolute paths and every parent traversal segment are denied even under a broad ** scope.

Decision: Run and Trace read-transform-write sections use short cross-process file locks; new Span records keep exclusive-create publication and numeric sequential allocation.

Contract semantics: allowedScope, forbiddenScope, requiredChecks, status, and lineage are machine policy. architectureBoundaries, definitionOfDone, rubric, stopConditions, and requiresUserDecision remain reviewer metadata, not automatic completion gates.

Dogfood evidence: INT-003 and RUN-004 exercised autonomous readiness, Plan, Contract, implementation, verification, and Wiki write through the CLI. This is an operational sample, not statistical proof of detection precision or long-term knowledge compounding.

Adapter compatibility: an absolute Write/Edit payload is accepted only when it resolves inside the repository, then converted to a repository-relative matcher target. Outside-root absolute paths and every explicit parent traversal remain blocked before any target read.

Completion evidence: RUN-004 reached verify with VE-001 typecheck and VE-002 unit_test fresh provenance, then INT-003 completed through the durable completion transaction and RUN-004 became passing/done.
