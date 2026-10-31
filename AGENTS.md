# AGENTS.md — Development Standards

These rules are mandatory for AI-assisted development in this repository.

They come in three layers: **General** (both frontend and backend) → **Frontend** → **Backend**.
On conflict, the more specific layer wins — except for three hard baselines in the General layer
(comments, module README, small-step commits), which must never be skipped under any circumstances.

---

## I. General Standards

### 1. Comments

- Every **newly added** function, method, and class must have a comment.
- A comment only needs to cover **what it does** and **what the parameters mean**. If one sentence covers it, do not add a second.
- Do not write comments that restate the code itself, such as "what this line does".

### 2. Module README

- Every **new module directory** must ship a `README.md` in the same batch, covering:
  1. The module's core function;
  2. **Why the module exists** (what problem it solves, what breaks without it);
  3. The responsibility of each file in the module;
  4. The call flow.
- Keep it concise but clear, without piling up jargon. Write for a reader who wants to understand and take over the code, not one who wants to admire the architecture.

### 3. Commit Rhythm

- **Each top-level module gets its own branch.** All modules and tasks under a top-level module share that branch; run `git merge` once every task in the module is done.
- **One commit per module.** Commit directly when verification is green; do not wait for an instruction from the user.
- **The commit message states only "what was done this time"**, in one clear sentence.
  **Strictly forbidden** in a message: technical details, file lists, implementation ideas, value derivations, pitfall notes — those belong in design docs and module READMEs.
  A message containing any of the above is non-compliant and must be rewritten into a short sentence on the spot; do not leave it.
- Check `git status` before committing; never add unrelated changes, temp files, or secrets.

### 4. Organizing Functions and Classes

- Keep functions small but complete, single-responsibility, with linear control flow and no deep nesting.
- Keep classes "cohesive and complete": every method belonging to that responsibility lives in the class, not scattered into external utility functions.
- Rule of thumb: put new code into an existing class first; open a new class/module only when the responsibility truly differs.

### 5. No Hardcoding

- Constants, thresholds, paths, timeouts, magic numbers, model names/ports, etc. must be extracted into a dedicated config layer, separate from classes and functions.
- No literals in business logic; copy used in multiple places is also extracted into constants.
- **Frontend and backend config stay independent**: each side has its own home for config, and neither references nor shares the other's config file.
  Where exactly is defined by the project README; sensitive values (keys, tokens, connection strings) go through environment variables, with the read entry point consolidated in the config layer.

### 6. Abstraction

- Reusable logic should be abstracted for easier maintenance; abstract only once something actually appears two or more times,
  with no assumption of future needs and no structure built for imagined scenarios.
- If a small amount of code fully implements the feature, do not introduce an intermediate layer. Default to the simplest structure with the fewest entities.

### 7. Dependencies and Tech Choices

- **If a feature can be fully implemented in very little code, never add an external dependency.**
- When an external dependency is genuinely needed: for unfamiliar libraries/APIs, **never make things up from memory or use outdated syntax**.
  Check the official docs first (prefer documentation retrieval tools such as Context7), or ask the user for material directly;
  start writing code only once the information is confirmed.
- Before adding a new dependency, explain "why we cannot implement it ourselves / why it is not cost-effective", and land it only after the user agrees.

### 8. Code Style Consistency

- Stay consistent with the existing context: naming, indentation, import order, error-handling style, and comment language all follow the existing code at the same layer.
- When the repo is newly initialized or style diverges, add a "Code Style Guide" under `doc/` as the standard; from then on, it is the authority.

### 9. Design and Plan Docs

- Docs go in the root `doc/` directory.
- Before development, write a PRD covering the architecture, tech stack, and a brief introduction to each feature module.
- For each new feature, create two docs:
  - `design-<feature>.md`: goals, approach and trade-offs, data structure/interface design, boundaries and exception handling;
  - `plan-<feature>.md`: task breakdown, execution order, and current progress (done / not done / rejected), as an ordered list marked with "√" for done, "x" for rejected, and "-" for not done.
- Docs are updated along with the implementation and serve as a progress ledger — not something written once and left aside.

### 10. Delivery Rhythm

- Deliver one small, human-reviewable module at a time; do not lay out a full design all at once.
- Keep every report to three parts: "what changed → how it was verified → what is next". Be concise.

### 11. Verification and Definition of Done

- Never claim "done" without having run the verification command. Type-checks/unit tests passing ≠ the feature works.
- UI changes: if it can start, actually start it and walk the main path and edge cases in the browser; if it cannot start, state clearly that it is unverified.
- Backend endpoints: send at least one real request and confirm the response structure and the error branches.

### 12. Error Handling and Robustness

- Validate only at system boundaries (external input, third-party APIs, files/network); internal calls trust each other — do not stack layer upon layer of defense.
- Failures must surface clear, locatable information (which step, what input, what was expected); never swallow exceptions silently.
- Do not write branches to cover "impossible" cases.

### 13. Security Baseline

- Keys, tokens, and credentials never go into code or commit history; use environment variables / secret config instead.
- Guard against injection flaws (SQL, command, XSS, path traversal); dynamically concatenated values must be parameterized or escaped.
- Never log sensitive fields.

### 14. Destructive Operations

- Confirm with the user before irreversible operations: deleting files/branches, `reset --hard`, `force push`, changing CI, wiping a database, and the like.
- For unfamiliar files, branches, or lock files, find out where they came from first; do not overwrite or delete them directly.

### 15. Root README

- When the project starts or the architecture changes, first spell out the overall directory structure, architecture, tech stack, and usage in the root `README.md`; all subsequent code is placed according to it — no each-writes-their-own.
- When adding/moving modules changes the directory, update the README in the same commit; the README must not stay out of sync with the actual structure.

---

## II. Frontend Standards

1. **Component encapsulation**: Encapsulate repeated, similarly styled parts into shared components where reasonable; but do not over-granularize — avoid layers of prop passing that create dependency problems. Rule of thumb: extract only when it reduces structure; do not flatten each page's current state in the name of "consistency".
2. **Directory layering by responsibility (fixed five categories)**: Frontend source is split into exactly these five directories;
   how to subdivide below them and how to name files follows the project's actual stack and existing style, documented in the root `README.md`:
   ```
   <frontend source root>/
     ├── pages/       # Layout file per page
     ├── components/  # Layout of each component within pages
     ├── types/       # Type parameters each component needs
     ├── styles/      # Global styles and style files of any component
     └── api/         # Types and interface definitions for requests
   ```
   - `pages/`: one layout file per page; page-level layout and composition only — do not pile component internals into the page.
   - `components/`: component layouts split out of pages, grouped into subdirectories by page/business.
   - `types/`: type parameters components need (props, state, local data models, etc.), one file per component name;
     types only, no runtime implementation.
   - `styles/`: the single home of styles. Global styles (variables, reset, theme) and each component's style files all live here,
     named to match the component; no stray style files inside component directories.
   - `api/`: request types and interface definitions, split into files by business module; components only call exports from `api/` and never write fetch/axios directly.
3. **Follow the design spec**: When the project provides a design spec, follow it strictly and keep the style consistent. The spec usually lives under `design/`. Read it before writing UI; do not guess values.
4. **APIs funneled by module**: All outbound requests are consolidated under `api/`, with a shared wrapper per module
   (base URL, auth headers, error-code mapping, retry/cancel); request parameter/response types and interface definitions live together in that module's file.
5. **State and side effects**: Define the "who switches whom" data flow before modeling state; avoid keeping the same piece of state in multiple places.
6. **Interaction feedback**: Loading, empty, error, and disabled states must all be explicit; no button without feedback.
7. **Responsiveness and accessibility**: Layouts adapt to narrow screens; interactive elements have keyboard reachability and semantic labels.

---

## III. Backend Standards

1. **Architecture layering**: Keep the architecture as clear and modular as possible; default to a layered architecture
   (interface layer → application/service layer → domain/business layer → data access layer).
   Which directories each layer maps to is defined by the project README; for very complex systems, DDD and microservices may be adopted —
   present the benefits and costs and get user confirmation before switching.
2. **Design principles and patterns**: Follow SOLID and other design principles, and apply patterns that fit the scenario
   (Factory, Strategy, Template Method, Observer, Repository/Adapter, Chain of Responsibility, etc.).
   **Patterns exist to remove real duplication/change points, not to show off**; a branch used only once does not deserve an abstraction.
3. **Thorough parameter validation**: Validate parameters thoroughly at entry points (type, range, required, format, enum, boundaries)
   with a unified validation mechanism/decorator rather than scattered ifs; validation rules live next to the request model, and error messages state exactly which field is invalid.
4. **Config and environment**: Config is separated from code and lives in the backend's config layer (not shared with the frontend), split by dev/test/prod;
   sensitive values go through environment variables, never into the database or repository.
5. **Data access**: Database operations are centralized in the data access layer; business code does not build SQL; schema changes are recorded as migration scripts,
   never by hand-editing production tables; batch endpoints avoid N+1 queries.
6. **Logging and observability**: Key flows and external calls have structured logs (including request/task identifiers) and traceable errors;
   unified log-level conventions.
7. **Unified response and exception handling**: Public endpoints share a response structure and error codes; a global exception handler is the single fallback —
   do not try/catch in every function.
8. **Testing**: Core business logic and validation rules get unit tests; every endpoint gets at least one integration test;
   tests that hit real dependencies must not mix with production data.

---
