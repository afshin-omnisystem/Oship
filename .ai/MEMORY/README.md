<!--- File ID: AI-MEMORY-002 -->
<!--- Title: Long-Term Memory -->
<!--- Version: 1.0.0 -->
<!--- Status: Active -->
<!--- Owner: Enterprise Architecture Team -->
<!--- Review Date: 2026-08-04 -->
<!--- Dependencies: .ai/INDEX.md -->
<!--- Related Files: .ai/SESSION_MEMORY.md, .ai/CURRENT_CONTEXT.md -->
<!--- AI Priority: High -->

# Long-Term Memory

## Overview

Long-term memory storage for important facts that persist across sessions. Short-term session memory lives in SESSION_MEMORY.md.

## Purpose

- Preserve critical knowledge across sessions
- Reduce context re-fetching
- Enable long-horizon planning
- Support AI agent continuity

## Structure

```
MEMORY/
├── README.md (this file)
├── CORE_FACTS.md       # Immutable core facts about project
├── DOMAIN_KNOWLEDGE.md # Domain expertise accumulated
├── TECH_STACK.md       # Tech stack decisions (future)
└── USER_PREFERENCES.md # User preferences learned
```

## Memory Management Rules

1. **Core facts are immutable**: Only add, never delete without decision log
2. **Summarize session memory**: At session end, extract important facts from SESSION_MEMORY.md into MEMORY/ files
3. **Quarterly cleanup**: Remove stale, outdated memories
4. **Version memory files**: Include metadata header, version tracking
5. **Cross-reference decisions**: Link to DECISION_LOG.md for traceability

## Core Facts Template

```
File ID: MEM-XXXX-001
Title:
Version:
Importance: Critical | High | Medium | Low
Date Added:
Source:
Fact:
Implications:
Related Decisions:
```

## Compaction Strategy

- SESSION_MEMORY.md may grow large during session
- At session end, AI agent should:
  1. Identify key facts worth preserving long-term
  2. Categorize into CORE_FACTS, DOMAIN_KNOWLEDGE, etc
  3. Add with proper metadata
  4. Keep SESSION_MEMORY.md focused for next session

## Cross References

- `.ai/SESSION_MEMORY.md` - Short-term active memory
- `.ai/DECISION_LOG.md` - Decisions that create long-term memories
- `.ai/CURRENT_CONTEXT.md` - Current context derived from long-term memory
- `docs/MASTER_CONTEXT/` - Human-readable version of core facts
