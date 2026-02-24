# External Skill Benchmark

## Purpose
Evaluate external architecture-planning skills and extract reusable patterns into canonical skill updates.

## Intake Package (per external skill)

- skill path or file
- intended use cases
- known strengths/weaknesses
- example user prompts
- license/attribution requirements (if applicable)

## Evaluation Matrix

1. Trigger quality
- Is the description precise enough to activate in the right context?

2. Workflow quality
- Does it provide repeatable multi-step execution?

3. Architecture rigor
- Are tradeoffs, risks, and readiness gates explicit?

4. Governance fit
- Does it support canonical docs, DEB/RFC flow, and anti-noise rules?

5. Operational cost
- Is it usable in real sessions with low overhead?

6. Portability
- Is it domain-agnostic or tightly coupled to one product?

## Merge Policy

- Keep: patterns that improve rigor without adding noise.
- Adapt: patterns useful but too verbose or product-specific.
- Reject: patterns that conflict with precedence, live-memory policy, or deadlock protocol.

## Required Output

- KEEP list
- ADAPT list
- REJECT list
- Text patch proposals for `skills/universal-architecture-tribunal/*`
