# KAIRO Docs Index

Estado: operativo (metodologia colaborativa activa)
Fecha: 2026-03-01

## Canonical Tree

```text
/
  00_TRIBUNAL_START_HERE.md
  AGENTS.md
  CODEX.md
  CLAUDE.md
  GEMINI.md
  00_KAIRO_MASTER_GOVERNANCE.md
  01_KAIRO_PRD_FINAL_v3-1.md
  03_KAIRO_PLANNING_POLICY_v1.md
  07_KAIRO_DEBATE_HISTORY.md
  /docs
    INDEX.md
    MIGRATION_STATE.md
    PLAN_INFALIBLE_v1.md (draft controlado)
    /04-research
      /external-skills
        architecture-patterns.md
    /00-governance
      00_TRIBUNAL_COLLAB_METHODOLOGY.md
      01_PROJECT_MEMORY.md
    /03-debates
      DEB-001_DOC_STRUCTURE_ALIGNMENT.md
      DEB-002_COLLAB_METHODOLOGY.md
      DEB-003_MEMORY_MODE_AND_SKILL_AUDIT.md
      DEB-004_METHOD_HARDENING_PATCHSET.md
      DEB-005_UNIVERSAL_SKILL_FINALIZATION.md
      DEB-006_EXTERNAL_SKILLS_BENCHMARK.md
      DEB-007_PERSONA_SCHEMA_ALIGNMENT.md
      DEB-008_PLANNING_HARDENING_AND_READINESS.md
    /06-rfcs
      RFC-TEMPLATE.md
  08_KAIRO_SETUP_GUIDE.md
  09_KAIRO_ONBOARDING_BETA.md
  10_KAIRO_RELEASE_CHECKLIST.md
  11_KAIRO_BETA_EXECUTION_PLAN.md
  12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md
  13_KAIRO_BETA_DAILY_TRIAGE.md
  14_KAIRO_BETA_EXIT_CRITERIA.md
  /docs
    /beta
      BETA_DASHBOARD.md
      BETA_BACKLOG.md
      /issues (per-issue .md files)
      /daily (auto-generated daily snapshots)
  /.github
    /ISSUE_TEMPLATE
      beta_bug_report.md
      beta_feedback.md
      config.yml
  /skills
    /universal-architecture-tribunal
      SKILL.md
      /references
        architecture-checklists.md
        debate-rubric.md
        external-skill-benchmark.md
    /tribunal-collaboration
      SKILL.md (legacy)
```

## Layout Note (Target vs Current)

The canonical tree above is the target layout for governance and collaboration.
Current filesystem may still include legacy or pre-tribunal artifacts pending migration.
Treat canonical governance files as source of truth and track migration deltas in:
- `docs/MIGRATION_STATE.md`
- `docs/03-debates/DEB-001_DOC_STRUCTURE_ALIGNMENT.md`

## Canonical Status

- `skills/universal-architecture-tribunal/SKILL.md` -> ACTIVA (baseline aprobada)
- `skills/tribunal-collaboration/SKILL.md` -> LEGACY
- `docs/00-governance/01_PROJECT_MEMORY.md` -> ACTIVO (Option B live snapshot)
- `CQL` -> INTEGRADO COMO GUARDRAIL V1.2 CANDIDATE (DEB-006)
- `docs/08_KAIRO_SETUP_GUIDE.md` -> v2.0 (dev setup + installer + troubleshooting)
- `docs/09_KAIRO_ONBOARDING_BETA.md` -> v1.0 (quickstart + smoke checklist)
- `docs/10_KAIRO_RELEASE_CHECKLIST.md` -> v1.0 (GO/NO-GO matrix + rollback)
- `docs/11_KAIRO_BETA_EXECUTION_PLAN.md` -> v1.0 (closed beta ops plan)
- `docs/12_KAIRO_BETA_BUG_INTAKE_TEMPLATE.md` -> v1.0 (bug report template)
- `docs/13_KAIRO_BETA_DAILY_TRIAGE.md` -> v1.0 (daily triage process)
- `docs/14_KAIRO_BETA_EXIT_CRITERIA.md` -> v1.0 (quantitative GO/NO-GO exit criteria)
- `docs/beta/BETA_DASHBOARD.md` -> v1.0 (auto-generated beta dashboard template)
- `docs/beta/BETA_BACKLOG.md` -> v1.0 (auto-generated issue backlog by classify script)
- `.github/ISSUE_TEMPLATE/beta_bug_report.md` -> v1.0 (GitHub issue template for bugs)
- `.github/ISSUE_TEMPLATE/beta_feedback.md` -> v1.0 (GitHub issue template for feedback)
- `.github/ISSUE_TEMPLATE/config.yml` -> v1.0 (issue template config)

## Startup Minimal

1. `00_TRIBUNAL_START_HERE.md`
2. `AGENTS.md`
3. `docs/00-governance/01_PROJECT_MEMORY.md`
4. `00_KAIRO_MASTER_GOVERNANCE.md`
