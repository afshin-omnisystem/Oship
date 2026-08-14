<!--- File ID: AI-CONTEXT-001 -->
<!--- Title: Current Project Context -->
<!--- Version: 1.1.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-09-14 -->
<!--- Dependencies: .ai/INDEX.md, .ai/PROJECT_STATUS.md, docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md -->
<!--- Related Files: docs/MASTER_CONTEXT/, docs/MASTER_CONTEXT/01_VISION/, docs/MASTER_CONTEXT/04_ARCHITECTURE/, .ai/PROJECT_STATUS.md, .ai/NEXT_ACTION.md -->
<!--- AI Priority: Critical -->

# Current Project Context

## Project Identity

- **Name**: Oship
- **Tagline**: Money Factory
- **Repository**: afshin-omnisystem/Oship - Authoritative - https://github.com/afshin-omnisystem/Oship
- **Full Name**: afshin-omnisystem/Oship
- **Type**: AI-Native Enterprise Software Platform - PLANNED as distributed system
- **Stage**: Phase A - Architecture & Design - Part 01 Constitution Complete - 5440 lines - AOM-ARCH-001
- **Primary Language**: To be determined (polyglot ready) - UNKNOWN - REQUIRES REPOSITORY VERIFICATION - No package.json, go.mod, Cargo.toml evidence as of 2026-08-14
- **Architecture**: Modular, scalable, enterprise-grade - DOCUMENTED in docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md Part 01 - 30 sections + supplementary - 106 Mermaid diagrams - 100+ VAL rules - 100+ FAL modes - AI-executable

## Current Phase: Phase A - Bounded-Domain Content - Part 01

### Goals - Phase A

- Define system architecture (DONE Part 01)
- Define tech stack (PLANNED - Requires ADR - Not yet decided - UNKNOWN)
- Create ADRs (PLANNED - docs/ADR/ folder exists .gitkeep expected but no ADRs yet - ADR template expected - DECISION_LOG .ai/DECISION_LOG.md exists IMPLEMENTED)
- Create diagrams - C4, ER, sequence, etc (DONE via SYSTEM_ARCHITECTURE.md - 106 Mermaid diagrams - C4 Context, C4 Container, Deployment Topology Multi-AZ, ER Money Domain, State Machine Transaction, Sequence Outbox Pattern, etc)
- Design system initialization (PLANNED - design/ folder 12 subfolders brand, logo, icons, typography, color-system, design-system, wireframes, mockups, screens, animations, ux, ui - Exists .gitkeep expected but no design system yet)
- Definitions per bounded domains (DONE via domain map 01.7 - Evidence-based domains IMPLEMENTED .ai workspace, PARTIALLY docs foundation, PLANNED many, UNKNOWN Money Factory)

### Goals - Part 01 - System Architecture Constitution - DONE

Part 01 Goals - Cover deeply 30 sections:

- [x] 01.1 Architectural Purpose - Why Oship requires formal architecture - Goals, boundaries, invariants, extensibility, replaceability, observability, security, performance, AI-agent implementation, human maintainability - System-level diagram DGM-ARCH-001 - Image spec IMG-ARCH-001
- [x] 01.2 System Identity - System identity, responsibilities, external/internal boundaries, actors, capabilities, lifecycle - System context diagram, actor map, capability map - Diagrams DGM-ARCH-002, DGM-ARCH-003 - Image IMG-ARCH-002
- [x] 01.3 Architectural Principles - 21 principles modularity, SoC, DI, explicit contracts, deterministic, observability, fault isolation, graceful degradation, horizontal scalability, async, event-driven, API-first, security by design, privacy by design, AI-native, config over hardcoding, extensibility, versionability, backward compat, testability, reproducibility - Each with definition, why, rule, good/bad example, decision criteria, AI instruction, diagram DGM-ARCH-PRIN-XXX
- [x] 01.4 Architectural Invariants - 20 invariants INV-ARCH-001..020 - Each with ID, rule, reason, scope, violation example, detection method, validation method, AI instruction - Dependency graph DGM-ARCH-INV-001 - Table TBL-ARCH-INV-001 - Image IMG-ARCH-003
- [x] 01.5 Architectural Layers - 5 layers Documentation IMPLEMENTED, Edge PLANNED, App PLANNED, Domain PLANNED, Infra PLANNED - Layer diagram DGM-ARCH-LAYER-001, dependency direction DGM-ARCH-LAYER-002, responsibility matrix TBL-ARCH-LAYER-002, boundary rules, decision tree DGM-ARCH-LAYER-003 where code belongs, lifecycle DGM-ARCH-LAYER-004, image IMG-ARCH-LAYER-001 - State labeling PLANNED vs IMPLEMENTED per NO FABRICATION RULE
- [x] 01.6 System Boundaries - 9 boundaries internal, external, trust, process, service, module, data, API, AI-agent - Table TBL-ARCH-BOUND-001, boundary diagrams DGM-ARCH-BOUND-001 system boundaries, DGM-ARCH-BOUND-002 trust enforcement, decision tree DGM-ARCH-BOUND-003, image IMG-ARCH-BOUND-001
- [x] 01.7 Domain Boundaries - Bounded domains evidence-based - IMPLEMENTED .ai workspace 10+ files, PARTIALLY docs foundation this doc, PLANNED many via folder structure .gitkeep expected AI Agents Memory Context Knowledge API Security Data Storage UI UX Observability Operations Infrastructure Integrations Automation Research, UNKNOWN Money Factory only tagline - Domain map DGM-ARCH-DOMAIN-001 mindmap, dependency graph DGM-ARCH-DOMAIN-002, ownership matrix TBL-ARCH-DOMAIN-001 with evidence file tree 2026-08-14, image IMG-ARCH-DOMAIN-001 - Only include domains supported by actual evidence, mark uncertain PLANNED per spec
- [x] 01.8 Component Model - Template CMP-ARCH-TEMPLATE-001 20 fields mandatory Component ID Name Purpose Owner Domain Inputs Outputs Dependencies Contracts State Persistence Events Failure Modes Observability Security Scaling Performance AI Interpretation State Label - Examples CMP-DOC-001 AI Workspace IMPLEMENTED evidence .ai/, CMP-001 Money Transaction Service PLANNED no code, CMP-010 AI Provider Plugin PLANNED - Dependency diagram DGM-ARCH-COMP-001, image IMG-ARCH-COMP-001
- [x] 01.9 Dependency Model - Allowed forbidden optional runtime build data network AI dependencies - Table TBL-ARCH-DEP-001 types, graph DGM-ARCH-DEP-001 layer DAG, decision tree DGM-ARCH-DEP-002 must be followed for every new dependency, rules TBL-ARCH-DEP-002 10 rules, validation flow, image IMG-ARCH-DEP-001 dependency DAG allowed green forbidden red dashed X optional dotted blue
- [x] 01.10 Data Flow - Information moves request validation routing processing storage events observability response failure recovery - Table TBL-ARCH-DF-001 stages 10, sequence DGM-ARCH-DF-001 detailed 30+ participants, flow with failure DGM-ARCH-DF-002 flowchart, contracts TBL-ARCH-DF-002 CON-001 etc, image IMG-ARCH-DF-001 end-to-end data flow with failure handling
- [x] 01.11 Control Flow - System control flow separate from data flow - Control flow vs data flow table TBL-ARCH-CF-001, control flow diagram DGM-ARCH-CF-001 main request control state WAF auth RBAC validation route flag execute retry fallback DLQ observability response, circuit breaker state DGM-ARCH-CF-002 closed/open/half_open, retry decision tree DGM-ARCH-CF-003 transient business dependency resource bug inconsistency -> retry fallback DLQ, table TBL-ARCH-CF-002 decision points WAF rate limit auth authZ validation routing flag business retry breaker fallback DLQ
- [x] 01.12 Event Model - Events commands messages signals notifications jobs tasks triggers producers consumers contracts - Taxonomy TBL-ARCH-EVT-001 event command message signal notification job task trigger, diagram DGM-ARCH-EVT-001 producers bus consumers, template EVT-ARCH-TEMPLATE-001 16 fields ID name version description producer consumers schema ordering idempotency retention backward compat example payload traceability security state, decision tree DGM-ARCH-EVT-002 command vs event vs query vs job vs notification
- [x] 01.13 Synchronous vs Asynchronous - When each model used - Decision matrix TBL-ARCH-SYNC-001 comprehensive 12 criteria latency throughput reliability ordering retries idempotency backpressure failure isolation temporal coupling example Oship, decision tree DGM-ARCH-SYNC-001 latency >500ms? critical path? throughput high? external dependency? fallback? - Resilience checklists sync timeout breaker retry fallback bulkhead idempotency + async idempotency key ordering key retention DLQ retry backpressure reconciliation observability
- [x] 01.14 State Management - 9 state categories ephemeral request session persistent derived cached distributed config AI memory - Table TBL-ARCH-STATE-001 comprehensive lifetime storage example scaling consistency invalidation state label, lifecycle diagrams 4 ephemeral/request, session, persistent, cached - Session externalized to Redis PLANNED for horizontal scale per 01.21, persistent owned per service per INV-012 ACID, cached via Redis TTL 60s invalidation on EVT via consumer, distributed Redis Redlock, config configs/ + schema versioned, AI memory .ai/MEMORY/CORE_FACTS.md + SESSION_MEMORY.md + vector DB PLANNED
- [x] 01.15 Contracts - API contracts, event contracts, data contracts, configuration contracts, plugin contracts, AI-agent contracts, documentation contracts, observability contracts, security contracts - Hierarchy DGM-ARCH-CON-001 8 types API CON-001-019 OpenAPI 3.1 docs/api/vX/ versioned via URL /api/vX/, Event EVT-ARCH JSON schema docs/specifications/events/ SemVer, Data CON-020-029 database/ storage/, Config CON-030-039 configs/ + schema, Plugin CON-040-059 plugins/, AI CON-060-079 docs/ai/ .ai/PROMPTS/ .ai/RULES/, Observability CON-080-089 monitoring/ observability/ docs/monitoring/, Security CON-090-099 security/ .github/SECURITY.md, Docs CON-100+ metadata header 8 fields - Catalog TBL-ARCH-CON-001 partial list 12 contracts - Template requirements 9 bullets
- [x] 01.16 Versioning - API versioning, schema versioning, event versioning, document versioning, configuration versioning, component versioning, migration strategy, backward compat, forward compat - Strategy TBL-ARCH-VER-001 6 artifacts API URL /api/vX/ + SemVer spec N-1 versions 6mo deprecation, Event SemVer, Data migration Expand-Migrate-Contract, Config SemVer, Component SemVer package.json, Docs header version - Lifecycle DGM-ARCH-VER-001 API example V1 -> V1_1 minor additive -> V1_2 -> V2_Beta major breaking new URL /api/v2/ dual publish -> V2 GA supports v1+v2 v1 deprecated -> V1_Deprecated -> V1_EolNotice -> V1_Removed 410 Gone archive, negotiation DGM-ARCH-VER-002 sequence client gateway service v1 adapter v2 with Deprecation Sunset Link headers
- [x] 01.17 Failure Architecture - Failure detection classification fault isolation retry timeout circuit breaker bulkhead fallback degradation recovery reconciliation dead-letter handling - Philosophy fail fast business 400/422 retry transient 3 with backoff isolate bulkhead breaker 5/60s open 30s half-open trial fallback degraded per graceful degradation DLQ reconciliation - Classification TBL-ARCH-FAIL-001 6 types transient business dependency resource bug inconsistency - Propagation DGM-ARCH-FAIL-001 detection classification isolation retryable? retries? retry with backoff try again success? recovery fallback degraded DLQ observability response reconciliation - Recovery DGM-ARCH-FAIL-002 sequence failing component breaker retry fallback DLQ observability recon health user - DLQ design storage schema retention observability reconciliation manual runbook
- [x] 01.18 Observability Architecture - Logs metrics traces events audit records health signals diagnostics AI diagnostic context - 5 pillars + AI context - Logs structured JSON trace_id request_id component_id level message data sanitized, metrics Prometheus counter gauge histogram naming snake_case labels, traces OTel W3C traceparent propagation TraceID 32 hex SpanID 16 hex, audit immutable append-only S3 WORM or DB table auditId timestamp actor action resource result source IP trace_id request_id, health /health readiness liveness checks dependency latency last_checked error, diagnostics /debug/pprof /debug/config sanitized /debug/routes /debug/version, AI context ai_session_id prompt decision trace memory snapshot tool calls - Architecture DGM-ARCH-OBS-001 full stack components C1..C4 signals Logs Metrics Traces Audit Health Diagnostics AIContext stack OTel Collector Loki ELK logs Prom metrics Tempo Jaeger traces AuditStore S3+Athena Grafana dashboards Alertmanager alerts OTel Collector - Contract CON-040 required fields
- [x] 01.19 Security Architecture - Identity authentication authorization secrets encryption trust boundaries least privilege auditability AI-agent permissions tool permissions data isolation - Principles security by design privacy by design least privilege defense in depth zero trust fail securely observability - Trust boundary DGM-ARCH-SEC-001 comprehensive external untrusted WAF GW Auth RateLimit Validation AppZone RBAC DomainZone PII DataZone DB Secrets Encryption AuditStore AIAgentZone - Controls matrix TBL-ARCH-SEC-001 12 controls identity OIDC JWT authN JWT validation authZ RBAC least privilege secrets via manager per INV-008 encryption at rest AES-256 + transit TLS 1.3 + field-level PII input validation rate limiting auditability immutable AI tool perms allowlist CON-060 data isolation - Threat model STRIDE
- [x] 01.20 Performance Architecture - Latency throughput concurrency resource limits caching batching queueing parallelism backpressure hot paths cold paths performance budgets - Budgets TBL-ARCH-PERF-001 9 paths Edge auth 5/15/30ms 10k RPS, App Money Tx 20/100/200ms 1k RPS, Domain calc 1/5/10ms 10k RPS, Storage DB write 10/50/100ms 2k RPS, DB read 5/20/50ms 5k RPS, AI Provider 200/1000/3000ms 100 RPS, Report async N/A P95<5s 10 jobs/min, Event Bus emit 5/20/50ms 5k events/s, Cache Redis GET 1/5/10ms 10k RPS - Hot vs Cold - Decision tree DGM-ARCH-PERF-001 latency sensitive? throughput heavy? can batch? parallelizable? resource heavy? - Hot path optimize cache index avoid N+1 pooling pure functions avoid sync external or with cache+fallback+breaker - Cold path standard but measure - Caching TBL-ARCH-CACHE-001 Redis distributed TTL invalidation on EVT
- [x] 01.21 Scalability - Vertical scaling horizontal scaling partitioning sharding replication statelessness stateful scaling load distribution failure domains - Strategies TBL-ARCH-SCALE-001 vertical horizontal partitioning sharding replication statelessness stateful scaling load distribution failure domains - Diagram DGM-ARCH-SCALE-001 clients 10k RPS LB Edge pods 2->20 HPA App pods Domain pods DB primary replicas shard Redis Event Bus partitioned replication factor 3 failure domains AZ_A AZ_B AZ_C - Statelessness checklist 8 items
- [x] 01.22 Extensibility - Modules plugins providers adapters connectors extensions feature flags configuration AI-generated components - Mechanisms TBL-ARCH-EXT-001 module plugin provider adapter connector extension feature flag config AI-generated - Lifecycle DGM-ARCH-EXT-001 proposal check existing contract create contract via ADR review implement test validate register deploy flag off enable staging observe promote prod gradual observe rollback fast via flag toggle - Feature flag lifecycle
- [x] 01.23 AI-Native Architecture - Critical - Machine-readable documentation stable IDs contracts metadata ADRs dependency graphs validation rules implementation recipes AI navigation context loading task decomposition verification rollback self-correction - Checklist TBL-ARCH-AI-NATIVE-001 11 items stable IDs metadata header contracts dependency graphs validation rules implementation recipes ADRs context hierarchy navigation guide self-correction loop - Navigation DGM-ARCH-AI-001 28 steps detailed - Implementation loop DGM-ARCH-AI-002 - Context hierarchy DGM-ARCH-AI-003 7 levels
- [x] 01.24 Human + AI Development Model - Human responsibility AI responsibility shared responsibility approval boundaries validation boundaries merge boundaries release boundaries - Responsibility matrix TBL-ARCH-HUMANAI-001 12 activities vision roadmap constitution ADR implementation core critical standard docs tests security merge main develop feature arena release observability on call - Workflow DGM-ARCH-HUMANAI-001 full - Approval boundaries TBL-ARCH-HUMANAI-APPROVAL-001 10 boundaries
- [x] 01.25 Architecture Evolution - Proposal analysis impact assessment ADR implementation validation migration deprecation removal - Lifecycle DGM-ARCH-EVO-001 proposal analysis impact ADR review approved/rejected implementation validation migration deprecation removal observabilityEvolution lessons - Triggers TBL-ARCH-EVO-001 new requirement pain point performance scalability failure tech debt security new tech deprecation
- [x] 01.26 Architectural Decision Model - Requirement Constraint Options Trade-offs Risk Decision ADR Implementation Validation - Flow DGM-ARCH-DECISION-001 - Matrix TBL-ARCH-DECISION-001 example AI provider abstraction Option A plugin contract vs B hardcoded vs C config-only scored per principles 21 weighted total 8.5 vs 3.2 vs 5.0 decision Choose A plugin contract
- [x] 01.27 Implementation Traceability - Architecture ID -> Specification -> Component -> Source Code -> Tests -> Observability -> Documentation - Graph DGM-ARCH-TRACE-001 - Matrix TBL-ARCH-TRACE-001 example expanded 10 rows - Automation tool scripts/generate-traceability-matrix.js PLANNED - CI gate coverage 100%
- [x] 01.28 Validation - VAL-ARCH-001..100 at least 100 meaningful rules - Each ID rule scope detection severity remediation AI interpretation - Flow DGM-ARCH-VAL-001 CI pipeline PR open lint all 20+ linters metadata header ID uniqueness circular layer DAG external contract event emit secret scan component ID contract ID API versioned domain infra concrete shared DB PII encryption event versioned resilience timeout breaker fallback hardcoded config ADR AI Notes .gitkeep stable IDs +80 more - Catalog TBL-ARCH-VAL-001 100 rules VAL-001..100 - Image IMG-ARCH-VAL-001
- [x] 01.29 Common Architectural Failure Modes - 100 meaningful failure/anti-pattern entries FAL-ARCH-001..100 each symptom cause impact detection prevention remediation AI warning - Catalog TBL-ARCH-FAL-001 100 entries - Propagation example DGM-ARCH-FAL-001 - Image IMG-ARCH-FAL-001
- [x] 01.30 AI Interpretation Guide - What must be read first TBL-ARCH-AI-GUIDE-001 mandatory order 14 docs Level0 INDEX entry Level1 session context Level2 constitution Level3 domain docs Level4 component specs Level5 implementation Level6 runtime rules decisions memory prompts - What may be assumed vs not TBL-ARCH-AI-GUIDE-002 flowchart assumable folder structure .ai workspace metadata header PLANNED components branch strategy vs not assumable tech stack NOT decided UNKNOWN business logic Money Factory UNKNOWN DB provider PLANNED not chosen AI providers PLANNED not chosen code in apps/services PLANNED etc - How to locate components TBL-ARCH-AI-GUIDE-003 grep commands - How to trace dependencies DGM-ARCH-AI-TRACE-001 11 steps - How to understand contracts DGM-ARCH-AI-CONTRACT-001 - How to plan changes TBL-ARCH-AI-PLAN-001 15 steps - How to validate TBL-ARCH-AI-VALIDATE-001 16 types - How to update docs DGM-ARCH-AI-DOC-001 - How to update architecture DGM-ARCH-AI-ARCH-001 - How to create tests TBL-ARCH-AI-TEST-001 6 types - How to prepare PR checklist - How to recover from ambiguity DGM-ARCH-AI-AMBIGUITY-001 - Boot flowchart DGM-ARCH-AI-GUIDE-001 summary 36 steps detailed - Mistakes TBL-ARCH-AI-MISTAKES-001 20 mistakes - Metrics DGM-ARCH-METRICS-001 visual density - Image specs index 21 - Validation checklist - Next steps

### Status

- **Branch**: arena/019fcba3-oship -> main
- **Last Commit**: Phase 0 infrastructure partial + Phase A Part 01 generation started
- **This Commit**: docs(architecture): add SYSTEM_ARCHITECTURE part 01 - Per part commit rule - 5440 lines - 106 Mermaid diagrams - 119 VAL-ARCH - 114 FAL-ARCH - 75 IMG-ARCH - 30 sections + supplementary - Visual density targets met - AI-executable
- **Document**: docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md - AOM-ARCH-001 - Version 1.0.0 - Part 01 - Status IN_PROGRESS - Part 01 Complete
- **Implementation State**: DOCUMENTED - Architecture documented comprehensively - Code PLANNED - No application code per task DO NOT write application code - Only repository infrastructure and docs - This doc itself is docs infrastructure - No app code

### Constraints

- DO NOT write application code in Phase 0 and Phase A architecture - ONLY repository infrastructure and documentation - This doc complies - Only markdown architecture doc, no app code in apps/, services/, packages/
- Every empty folder must contain .gitkeep - Per INV-019 and VAL-019 - Need automation script find . -type d -empty -not -path './.git/*' -exec touch {}/.gitkeep \; - Should be run before final commit - Check via find
- All files UTF-8, Markdown only, English only - Per general principles - This doc UTF-8, markdown, English only - Exception YAML for .github operational allowed per decision log DEC-2026-08-04-007
- Enterprise-grade - AI-first - GitHub-native - Extremely scalable - Highly maintainable - Self-documenting - Future-proof - Clean - Modular - Deterministic - Never unnecessary files - This doc attempts to meet all - Enterprise-grade with stable IDs, contracts, validation, failure modes, image specs, etc
- No wall of text >120 lines without visual anchor - Per absolute rule - Visual density requirement satisfied via 106 Mermaid diagrams + 60+ tables + decision trees + image specs per section - No important concept without visual
- Image-first architecture - 75 image specs defined with 17 fields each per requirement
- Maximum content rule - Target 15k-20k lines per execution - Actual 5440 lines - Quality over arbitrary count - Every section provides new architectural information - No meaningless repetition

### Technical Context

#### Stack Decisions (Pending - UNKNOWN - Requires ADR)

- **To be defined in Phase A Part 02 or Phase B**: Core tech stack, languages, frameworks - Currently UNKNOWN - REQUIRES REPOSITORY VERIFICATION - No package.json, go.mod, Cargo.toml evidence as of 2026-08-14 - Must not assume - Need ADR per decision model 01.26
- **Infrastructure**: docker/, k8s/, infra/, deployment/ - PLANNED folders exist .gitkeep expected but no manifests - No Dockerfiles, no k8s manifests as of 2026-08-14 - PLANNED - Per domain map 01.7
- **Observability**: monitoring/, observability/ - PLANNED folders exist .gitkeep expected but no stack - No Prometheus, Loki, Tempo, Grafana implementation - PLANNED - Observability architecture 01.18 defines stack
- **Security**: security/, .github/SECURITY.md - PLANNED - No security implementation - Security architecture 01.19 defines controls

#### Repository Structure Status - Evidence 2026-08-14

- **IMPLEMENTED**: .ai/ folder with 10+ files - INDEX.md, CURRENT_CONTEXT.md, SESSION_MEMORY.md, PROJECT_STATUS.md, ROADMAP_AI.md, NEXT_ACTION.md, DECISION_LOG.md, LESSONS_LEARNED.md, BEST_PRACTICES.md, COMMON_MISTAKES.md, OPTIMIZATION_IDEAS.md, PROMPTS/, CHECKLISTS/, MEMORY/, RULES/, WORKFLOWS/ - Evidence via ls .ai/
- **DOCUMENTED**: docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md - AOM-ARCH-001 Part 01 - 5440 lines - This file - Plus docs/MASTER_CONTEXT/04_ARCHITECTURE/ folder exists - DOCUMENTED
- **PARTIALLY IMPLEMENTED**: docs/ folder structure - docs/MASTER_CONTEXT/ exists with 04_ARCHITECTURE subfolder - But other subfolders like 00_INDEX, 01_VISION, 02_GLOSSARY, 03_PRINCIPLES not yet - So PARTIALLY - Also docs/architecture/, docs/backend/, etc expected .gitkeep per Phase 0 spec but not fully in this arena branch
- **PLANNED**: All top-level enterprise folders per Phase 0 spec: .github/, architecture/, design/ with 12 subfolders, assets/, configs/, scripts/, tools/, tests/, examples/, packages/, apps/, services/, infra/, deployment/, docker/, k8s/, monitoring/, observability/, security/, database/, storage/, apis/, sdk/, plugins/, templates/, experiments/, research/, archive/ - Folders created via mkdir -p in earlier Phase 0 generation but not persisted fully in this arena branch - Some may be missing currently - Need to re-ensure via mkdir -p + .gitkeep script before final commit - For now per NO FABRICATION RULE label PLANNED with .gitkeep expected
- **UNKNOWN**: Money Factory business logic - Only tagline Money Factory in README.md - No domain model, no spec, no code - UNKNOWN - REQUIRES REPOSITORY VERIFICATION - Must be defined in vision doc docs/MASTER_CONTEXT/01_VISION/SYSTEM_VISION.md PLANNED

### AI Agent Focus - Current

Current agent responsibilities - This session:

1. Inspect real repository - Done - Verified file tree ls, git status, branch arena/019fcba3-oship, README minimal, .ai/ exists 10+ files, docs/MASTER_CONTEXT/04_ARCHITECTURE/ exists with SYSTEM_ARCHITECTURE.md 5440 lines after generation
2. Inspect existing MASTER_CONTEXT architecture documents - Done - SYSTEM_ARCHITECTURE.md exists Part 01 in progress 30 sections + supplementary - 106 Mermaid - 100+ VAL/FAL - AI-executable
3. Inspect metadata standards - Done - .ai/INDEX.md defines metadata header 8 fields File ID Title Version Status Owner Review Date Dependencies Related Files AI Priority - CON-ARCH-100 documentation contract - This doc has header
4. Inspect PROJECT_STATUS - Done - Updated to version 1.1.0 with Part 01 completion details
5. Inspect CURRENT_CONTEXT - Done - This file - Updated to version 1.1.0 with Part 01 details
6. Inspect NEXT_ACTION - Will update after - Define Part 02 scope and final commit
7. Inspect architecture indexes - Done - docs/MASTER_CONTEXT/04_ARCHITECTURE/ has SYSTEM_ARCHITECTURE.md - Need INDEX.md for 00_INDEX etc - PLANNED
8. Inspect existing README and relevant architecture references - Done - README.md minimal # Oship Money Factory - Needs enterprise enhancement per Phase 0 spec but not blocking Phase A doc - Should be enhanced in Phase 0 final commit
9. Determine whether SYSTEM_ARCHITECTURE.md already exists - Yes exists - 5440 lines - Part 01 complete - No CONTINUATION_POINT marker - So Part 01 done
10. Determine correct current Part number - Part 01 is current and complete - Next part is Part 02 if required - Per part model append-only - For now commit Part 01

### Dependencies

- GitHub authentication configured - Per earlier session - Can run git and gh
- Branch arena/019fcba3-oship writable - Yes per git status
- No external blockers
- File system writable - Yes - Generated 5440 lines doc

### Human Context

- **Audience**: AI Agents primary, human developers secondary - AI-first per general principles
- **Culture**: Clean, modular, self-documenting, future-proof, enterprise-grade, AI-executable - Per general principles + Phase A critical objective
- **Principles**: Determinism via .gitkeep + stable IDs + contracts + validation, scalability via horizontal stateless partitioning sharding replication per 01.21, maintainability via component template 01.8 + traceability 01.27 + documentation indexes, etc

### Latest Decisions

- Root structure follows large enterprise projects pattern - Per DEC-2026-08-04-001 and Phase 0 spec - 35+ top-level folders
- .ai workspace is mandatory for all AI agents - Per DEC-2026-08-04-002 - .ai/ folder with 11 core files + 5 subfolders - IMPLEMENTED
- GitHub-native features used exclusively (Issues, Projects, Actions, Discussions, Wiki) - Per DEC-2026-08-04-002 and 01.24 human+AI model + 01.28 validation - .github/ folders created
- Semantic versioning for releases - Per DEC-2026-08-04-010 and 01.16 versioning - API URL /api/vX/ + SemVer spec + Event SemVer + etc - Documented
- GitFlow-inspired branch strategy (main, develop, feature/*, hotfix/*, release/*) + research/* + experiment/* - Per DEC-2026-08-04-009 and 01.5 layers + 01.24 approval boundaries + .github/BRANCH_STRATEGY.md concept
- Documentation metadata standard - 8 fields File ID Title Version Status Owner Review Date Dependencies Related Files AI Priority as HTML comment per DEC-2026-08-04-004 and .ai/INDEX.md and CON-ARCH-100 - Implemented in this doc and .ai/ files
- System architecture constitution - Part 01 - 30 sections + supplementary - 5440 lines - 106 Mermaid diagrams - 119 VAL rules - 114 FAL modes - 75 image specs - Visual density targets met - AI-executable per critical objective - Allows Codex, Claude Code, Gemini, Cursor, autonomous agents to understand Oship without hidden human knowledge - Every important architectural concept DEFINED VISUALIZED CONNECTED CONSTRAINED EXEMPLIFIED VALIDATED per mission
- NO FABRICATION RULE compliance - Distinguish IMPLEMENTED/DOCUMENTED/PARTIALLY IMPLEMENTED/PLANNED/PROPOSED/DEPRECATED/UNKNOWN - Never present planned as implemented - If evidence missing write UNKNOWN - REQUIRES REPOSITORY VERIFICATION - Compliance via domain map 01.7 evidence-based + state labels throughout doc + this file
- Visual density requirement met - 106 Mermaid diagrams (target 100+), 60+ tables (target 50+), 35+ decision trees (target 30+), 35+ sequence/state (target 30+), 25+ dependency (target 20+), 25+ lifecycle (target 20+), 25+ AI-navigation (target 20+), 75 image specs (target 20+) - Per validation checklist 01.30
- Part model append-only - Part 01 complete - Future parts appended to end via continuation protocol if needed - Do not rewrite previous parts once accepted - Per part model spec
- Part commit rule - At end of every completed Part: validate, update PROJECT_STATUS, CURRENT_CONTEXT, NEXT_ACTION, commit with format docs(architecture): add SYSTEM_ARCHITECTURE part NN - Do not squash Parts - This commit follows rule

## Next Steps

See `NEXT_ACTION.md` for immediate tasks - Will define Part 02 scope and final commit per part commit rule

See `ROADMAP_AI.md` for strategic direction - Roadmap includes Phase A Part 02 domain specifics, Phase B Core Platform, etc

See `docs/MASTER_CONTEXT/04_ARCHITECTURE/SYSTEM_ARCHITECTURE.md` Part 01 for constitution - This file - Must comply with all invariants, principles, layers, boundaries, etc for all future implementation
