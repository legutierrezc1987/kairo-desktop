# Architecture Checklists

## Intake Checklist

- Problem statement and business objective
- Scope and non-goals
- Constraints (budget, timeline, team, infra)
- Quality attributes (latency, availability, security, cost)
- Compliance context (if applicable)
- Success metrics (technical + business)

## Option Evaluation Checklist

- Feasibility with current team capabilities
- Migration complexity
- Operational burden
- Failure modes and blast radius
- Observability and testability
- Cost predictability
- Vendor lock-in risk

## Readiness Gate

- canonical docs updated
- unresolved critical risks tracked with mitigations
- owners assigned for next actions
- validation strategy defined
- rollback strategy defined for high-impact moves
- promoted decisions include attribution tags when applicable

## Pattern Evaluation Checklist

- Dependencies flow toward domain/core, not toward infrastructure
- Interfaces are focused and small enough for substitution/testing
- Business logic is independent from framework/transport/ORM details
- Controllers/adapters remain thin and delegate business rules
- Pattern complexity is proportional to problem complexity (avoid over-engineering)

## Macro-Patterns (Hypothesis Guidance)

- Clean Architecture: layered separation with inward dependencies
- Hexagonal (Ports & Adapters): interchangeable infrastructure around a stable core
- DDD: bounded contexts, ubiquitous language, rich domain behavior

## Antipattern Triggers (Audit)

- Anemic Domain: entities are data containers without behavior
- Framework Coupling: domain rules depend on framework/ORM/transport
- Fat Controllers: business logic placed in interface adapters
- Over-Engineering: strict DDD/Clean for trivial CRUD scope
- Flat Error Handling: treating all errors identically without operational/programmer/validation distinction
- Resource Starvation Vectors: synchronous or unbounded O(N) operations in critical paths that can block execution or exhaust pools

## Execution Resilience & Production-Readiness

When vetting architectures for production delivery, ensure criteria for:

- Boundary Validation: strict schema validation at the earliest API boundary (fail-fast)
- Error Taxonomy: explicit distinction between operational vs programmer/panic errors with standardized response shapes
- Lifecycle Control: startup/shutdown order, graceful drain, and explicit cleanup
- Resource Protection: bounded pools, endpoint rate limiting, and prevention of starvation vectors (e.g., unbounded O(N) operations in hot paths)
- Environment Integrity: secrets/config loaded and validated at startup (fail-fast on missing/invalid)
- Deep Observability: health endpoints must validate downstream dependencies, not only HTTP 200
