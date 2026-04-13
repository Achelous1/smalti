## Documentation (`docs/`)

### Spec Documents

Human-authored specification documents that define what AIDE is and how it should work. These are the authoritative design references — read them before making architectural or feature decisions.
- **`PRD.md`** — Product Requirements Document. Defines the product vision, problem statement, core "Create n Play" concept, feature list (F1–F7), and MVP success criteria.
- **`TRD.md`** — Technical Requirements Document. Defines the tech stack, Electron 3-process architecture, IPC contract, plugin sandbox model, and platform-specific constraints.
- **`UI-SPEC.md`** — UI Functional Specification. Defines every UI component's behavior, states, and interactions (Welcome page, Terminal page, panels, tabs, plugin views).

### Raw Sources (`docs/raw/`)

Immutable source documents — articles, papers, reference data — that the LLM reads for context but **never modifies**. These are the source of truth for background knowledge. Treat them as read-only.

### Wiki (`docs/wiki/`)

LLM-generated markdown files. Summaries, entity pages, concept pages, comparisons, overviews, and synthesis documents. The LLM owns this layer entirely — create, update, and reorganize files here freely as understanding of the project evolves.
