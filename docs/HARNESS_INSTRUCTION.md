# HARNESS_INSTRUCTION.md

> **Status:** Draft v0.2 — foundational research synthesis (re-scoped)
> **Audience:** Anyone (human or agent) who develops the AIDE codebase
> **Purpose:** Establish a shared vocabulary and structural template for the **harness we use to build AIDE**. AIDE is the product. The harness is the multi-agent dev-time system that produces it. Subsequent documents (`HARNESS_ARCHITECTURE.md`, `HARNESS_AGENTS.md`, per-component `CLAUDE.md` updates) build on the definitions here.

---

## 0. Scope clarification (read this first)

This document is **not** about runtime behavior of the AIDE Electron app. It is about **how AIDE gets built**.

| Layer | Subject of this doc? |
|---|---|
| AIDE runtime (Electron main / preload / renderer / plugins) | ❌ No — covered by `PRD.md`, `TRD.md`, `UI-SPEC.md` |
| The CLI agents AIDE hosts (Claude Code / Gemini / Codex) at runtime | ❌ No |
| **The dev-time harness (planner / executor / verifier sub-agents, CLAUDE.md routing, verification loops) that we use to write AIDE source code** | ✅ Yes — this doc and its children |

So when this doc says "the harness", it always means the dev-time scaffolding around the engineer (human or LLM) producing changes to `src/main`, `src/renderer`, `src/preload`, `plugins/`, etc.

## 1. What is a (Coding Agent) Harness?

A **harness** is everything between an LLM and the real codebase — every line of code, configuration, and execution rule that is *not* the model itself. The model generates text; the harness decides what that text is allowed to touch, how it gets verified, and what happens when it goes wrong.

> "The model is the brain. The harness is the body. Even a frontier model running in a loop across multiple context windows will underperform without a well-designed harness." — Martin Fowler

Two complementary lineages converge on the term:

| Lineage | What it means | Why we want it for AIDE dev |
|---|---|---|
| **Test harness** (classical SE, since 1980s) | Drivers + stubs + fixtures + reporting that exercise a system under controlled conditions. | Already partially in place: `tests/unit` (Vitest) and `tests/e2e` (Playwright). These are the *verification surface* the dev harness will hook into. |
| **Coding-agent harness** (LLM-era, 2024–2026) | Tool dispatch, permission model, context window management, session state, verification loops, hooks, recovery — wrapped around a non-deterministic model so it can ship code reliably. | This is what we are building. The goal: any agent (or human + agent) can pick up an AIDE task, execute it safely, and produce a verifiable change with minimal hand-holding. |

## 2. Why We Are Doing This Now

The 2026 industry shift framed by Anthropic, Martin Fowler, LangChain, and others:

- **Prompt engineering → harness engineering.** Model capability is no longer the bottleneck. The bottleneck is the *external control structure* that keeps a non-deterministic agent from drifting, looping, hallucinating tool calls, or declaring victory prematurely.
- **57.3%** of teams surveyed by LangChain now run agents in production; **89%** have implemented observability; **52%** have evals. Harness quality is the dividing line between "demo" and "ship".
- **Anthropic's three-agent harness** (planner / generator / evaluator, GAN-inspired) outperformed a solo Opus 4.5 run on the same task: 6 hours / $200 produced a working full-stack app where solo / 20 min / $9 produced non-functional output. The win came entirely from the harness, not the model.

**Implication for AIDE development:**
- AIDE has 12 component-level `CLAUDE.md` files, a documented set of pitfalls (in the root `CLAUDE.md`), tight Electron security constraints, and three-process IPC. A single un-scaffolded LLM session will repeatedly violate these. We need the harness to *enforce* what the docs already *describe*.
- Recent shipping velocity (auto-update, auto-open last workspace, persistent xterm cache, plugin hot-reload) is increasing. Without dev-side verification loops, regressions across these areas will compound.

## 3. Core Subsystems of a Coding Agent Harness

Synthesized from Martin Fowler's "Harness engineering for coding agent users", Anthropic's "Harness design for long-running application development", LangChain's "Anatomy of an agent harness", and MorphLLM's IMPACT framework. Each row also notes the **current state in our AIDE dev workflow** and **what is missing**.

| # | Subsystem | Responsibility | State in AIDE dev workflow today |
|---|---|---|---|
| 1 | **Prompt Composition** | Assemble agent system prompt from prioritized modular sections (identity, scope, tools, style, escalation policy). | Implicit only — lives in scattered `CLAUDE.md` files. No single agent identity card. **Gap.** |
| 2 | **Tool Registry & Dispatch** | Decide which tools an agent may call, route them, and log them. | Inherited from Claude Code defaults. Project-side tool restrictions not declared. |
| 3 | **Permission & Authority** | Sandbox, approval gates, dangerous-command detection, scope restrictions ("agent X may only touch `src/main/agent/`"). | Not declared. A dev agent today can edit anywhere. **Gap.** |
| 4 | **Context Engineering** | Curate what enters the model's context window: which `CLAUDE.md` to load, which files to read first, when to compact. | Partial — root `CLAUDE.md` is loaded automatically; component-level files are not auto-routed by directory. |
| 5 | **Session State & Handoff** | Survive context resets and stage transitions; preserve decisions / rejected alternatives / risks. | None. Memory lives only in conversation history. **Gap.** |
| 6 | **Verification Loop** | Check agent output before it lands: lint, type-check, unit test, e2e test, evaluator agent, human approval. | Manual: `pnpm lint`, `pnpm test`, `pnpm test:e2e` exist but are not wired to a per-change agent loop. **Largest gap.** |
| 7 | **Safety Net & Recovery** | Iteration caps, doom-loop detection, hooks, cooperative cancellation, rollback. | Some `.claude/` hooks present (`.omc`, `pretooluse`). No project-level cap or rollback policy. |
| 8 | **Observability** | Structured logs of agent actions, tool calls, verification outcomes — replayable and queryable. | None for dev-side agents. **Second-largest gap.** |
| 9 | **Meta-cognition / Self-critique** | Pre-action critique step, post-action retrospection. | Delegated to whatever model the engineer happens to use. |
| 10 | **Specialist Sub-agents** | Distinct agents for plan / code / test / review, each with narrow scope and tools. | Not yet defined. Will live under `.claude/agents/` and be the focus of `HARNESS_AGENTS.md`. |

## 4. Reference Patterns

### 4.1 The ReAct Loop (single-agent baseline)
```
pre-check & compaction → think → self-critique → act → tool-execute → post-process → loop
```
Surrounded by the 10 subsystems above. This is the inner loop every dev agent runs. The harness's job is to *constrain* and *observe* this loop.

### 4.2 The Three-Agent Harness (Anthropic, 2026)
GAN-inspired multi-agent decomposition for long-running work. **This is the pattern we want to mirror for AIDE feature development:**

```
Planner   ──▶ takes a one-line task ("add a workspace search bar")
              and produces a detailed spec referencing AIDE's
              architecture and pitfalls.

Generator ──▶ implements one slice of the spec at a time, edits
              files, runs `pnpm lint` + scoped tests.

Evaluator ──▶ runs the verification loop end-to-end (lint, type,
              unit test, e2e test, optionally Playwright UI check
              against the running app), critiques, sends the
              generator back to fix.
                                │
                                └── loop until evaluator approves
                                    OR iteration cap hit OR human
                                    is paged.
```

### 4.3 Verification Loops (highest-impact pattern)
> "Verification loops check agent outputs before they reach the real world. This is the single highest-impact pattern in agent harness engineering."

For AIDE, the concrete checks the harness must enforce are:

| Check | When | Tool |
|---|---|---|
| TypeScript compiles | After every multi-file edit | `pnpm exec tsc --noEmit` |
| ESLint passes | After every edit | `pnpm lint` |
| Unit tests pass (scoped) | After edits to `src/main/**` or `src/renderer/**` | `pnpm test --run <pattern>` |
| E2E smoke passes | Before merge | `pnpm test:e2e` |
| Pitfall regex sweep | After any edit to terminal / xterm / pty / IPC code | grep for the patterns called out in root `CLAUDE.md` "Known Pitfalls" |
| LLM-as-judge over diff | Optional, before human review | A reviewer sub-agent reads the diff |
| Human approval | Irreversible ops only (push, release, dependency changes) | Manual gate |

### 4.4 Context Resets with Structured Handoffs
When the agent's context grows past the useful window, do **not** just compact. Write a structured handoff (decisions, rejected alternatives, risks, files touched, remaining work) into a known location and start the next agent fresh with the handoff in its initial prompt.

Format (10–20 lines max):
```markdown
## Handoff: <stage> → <next-stage>
- **Decided**: …
- **Rejected**: …
- **Risks**: …
- **Files**: …
- **Remaining**: …
```
Storage location: **TBD** — proposal in `HARNESS_HANDOFFS.md`. Likely `.aide-harness/handoffs/<task-slug>/<stage>.md`.

### 4.5 IMPACT Framework (MorphLLM)
Six components every coding-agent harness must implement. We will use these as the rubric for `HARNESS_AGENTS.md`:

| Letter | Component | Where it gets defined for an AIDE dev agent |
|---|---|---|
| **I** | Identity (role, voice, values) | `SOUL.md` per agent |
| **M** | Memory (session, scratchpad, long-term) | Handoff artifacts (§4.4) + project memory (`.claude/projects/.../memory/`) |
| **P** | Planning | Owned by the Planner sub-agent (§4.2) |
| **A** | Authority (permissions, scope) | `IDENTITY.md` per agent (allowed paths, allowed tools, escalation policy) |
| **C** | Context (curation, compaction) | Per-component `CLAUDE.md` + handoff artifacts |
| **T** | Tools (dispatch, verification) | `IDENTITY.md` `tools:` field + verification loop hooks |

## 5. Document Structure for the AIDE Harness Series

This file is the **root**. Everything below is a child document. Each child must follow the template in §6.

```
docs/
  HARNESS_INSTRUCTION.md         ← you are here
                                    (vocabulary, principles, scope)

  HARNESS_ARCHITECTURE.md        ← TODO: how the dev harness wraps
                                    the AIDE codebase. Where agents
                                    live (.claude/agents/), where
                                    handoffs live, how verification
                                    hooks attach to existing scripts.

  HARNESS_AGENTS.md              ← TODO: the agent roster + the
                                    SOUL.md / IDENTITY.md format.
                                    One row per agent: name, model,
                                    scope, allowed tools, escalation.
                                    Locks the schema this doc defers.

  HARNESS_VERIFICATION.md        ← TODO: the verification loop in
                                    detail. Which checks run when,
                                    how the evaluator agent reads
                                    their output, retry policy.

  HARNESS_OBSERVABILITY.md       ← TODO: structured logging of
                                    agent actions and verification
                                    outcomes. Where logs land, how
                                    they get replayed.

  HARNESS_HANDOFFS.md            ← TODO: handoff artifact format,
                                    storage location, lifecycle
                                    (write / read / archive).
```

### Component-level `CLAUDE.md` updates

Every existing `CLAUDE.md` (`src/main/CLAUDE.md`, `src/renderer/CLAUDE.md`, `src/preload/CLAUDE.md`, `src/types/CLAUDE.md`, `tests/unit/CLAUDE.md`, `tests/e2e/CLAUDE.md`, `docs/CLAUDE.md`, `.github/workflows/CLAUDE.md`, `.omc/CLAUDE.md`, root `CLAUDE.md`) should gain a **"Harness scope"** section so dev agents know who is allowed to touch this directory and which verification checks are mandatory after edits here. Example:

```markdown
## Harness scope
- **Owning agents**: src-main-agent, src-main-ipc-agent
- **Allowed tools**: Read, Edit, Write, Bash(pnpm lint, pnpm test --run)
- **Mandatory post-edit checks**: tsc --noEmit, pnpm lint, pnpm test --run src/main
- **Pitfalls active here**: §"Zustand: Never mutate state snapshots", §"node-pty + fix-env", §"beforeunload async IPC" (see root CLAUDE.md)
- **Escalation**: any change to IPC channel names → human review required.
```

### Stray files to clean up

Two `CLAUDE.md` files exist at the wrong location and should be deleted (or merged into the correct ones) as part of `HARNESS_ARCHITECTURE.md`:

- `/main/CLAUDE.md` → real code lives in `src/main/`, file is stray
- `/preload/CLAUDE.md` → real code lives in `src/preload/`, file is stray

## 6. Template for Child Documents

Every `HARNESS_*.md` file in this series MUST contain:

```markdown
# <TITLE>

> Status / Audience / Purpose

## 1. Subsystem(s) covered
Reference §3 of HARNESS_INSTRUCTION.md by number.

## 2. Current state in the AIDE dev workflow
Files, scripts, hooks, CLAUDE.md sections involved today. Cite paths.

## 3. Gaps vs. reference
Which reference pattern (§4) is missing or partial.

## 4. Proposed structure
Concrete files / directories / hooks / npm scripts to add or rename.
No code yet — just shape and contracts.

## 5. Acceptance criteria
How we know the work is done (verification hooks, tests, manual checks,
example agent run).

## 6. Open questions
Decisions still owed by the human.
```

## 7. Glossary

| Term | Meaning in this doc series |
|---|---|
| **Harness** | The dev-time non-model code that gives an LLM state, tools, permissions, scope, and feedback loops while it edits the AIDE codebase. |
| **Dev agent** | Any agent (Claude Code session, sub-agent, or human-in-the-loop pair) that produces changes to AIDE source code. |
| **Sub-agent** | A specialized dev agent with narrow scope and tools — e.g., planner, generator, evaluator, reviewer. Defined in `.claude/agents/<name>/`. |
| **Owning agent** | The sub-agent(s) primarily responsible for a directory. Declared in that directory's `CLAUDE.md` "Harness scope" section. |
| **SOUL.md** | (Schema locked in `HARNESS_AGENTS.md`.) Long-form character / values / collaboration style for an agent. |
| **IDENTITY.md** | (Schema locked in `HARNESS_AGENTS.md`.) Short, machine-parseable role card: name, model, allowed paths, allowed tools, escalation policy. |
| **Handoff artifact** | A short markdown file (10–20 lines) capturing decisions / rejected alternatives / risks / remaining work at a stage boundary. |
| **Verification loop** | The lint / type / test / evaluator sequence that runs against an agent's output before the change is accepted. |
| **Iteration cap** | Maximum number of generator↔evaluator cycles before the harness escalates to a human. |
| **IMPACT** | MorphLLM's six-component coding-agent rubric: Identity, Memory, Planning, Authority, Context, Tools. |

## 8. Sources

- [Harness engineering for coding agent users — Martin Fowler / Birgitta Böckeler](https://martinfowler.com/articles/harness-engineering.html)
- [Harness design for long-running application development — Anthropic Engineering](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic Designs Three-Agent Harness Supports Long-Running Full-Stack AI Development — InfoQ](https://www.infoq.com/news/2026/04/anthropic-three-agent-harness-ai/)
- [The Anatomy of an Agent Harness — LangChain Blog](https://blog.langchain.com/the-anatomy-of-an-agent-harness/)
- [State of Agent Engineering — LangChain](https://www.langchain.com/state-of-agent-engineering)
- [Demystifying evals for AI agents — Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Agent Engineering: Harness Patterns, IMPACT Framework & Coding Agent Architecture (2026) — MorphLLM](https://www.morphllm.com/agent-engineering)
- [Claude Code Agent Harness: Architecture Breakdown — WaveSpeedAI](https://wavespeed.ai/blog/posts/claude-code-agent-harness-architecture/)
- [Skill Issue: Harness Engineering for Coding Agents — HumanLayer](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents)
- [Agent Harness Engineering Guide [2026] — QubitTool](https://qubittool.com/blog/agent-harness-evaluation-guide)
- [What is an agent harness? — Parallel Web Systems](https://parallel.ai/articles/what-is-an-agent-harness)
- [Test harness — Wikipedia](https://en.wikipedia.org/wiki/Test_harness)
- [Test harness: Definition, benefits & uses — Tricentis](https://www.tricentis.com/learn/test-harness)

---

**Next step (per user instruction):** create `HARNESS_AGENTS.md` defining the dev-agent roster + the SOUL.md / IDENTITY.md format, then revisit each component-level `CLAUDE.md` to add the "Harness scope" section described in §5.
