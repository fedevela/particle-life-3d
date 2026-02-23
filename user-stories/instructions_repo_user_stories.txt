User Story Discovery and Cataloging Guide for Any Software Repository

1) Objective
- Identify, infer, and document user stories from an existing repository in a consistent, repeatable way.
- Capture both explicit requirements (documented) and implicit requirements (behavior inferred from code and tests).

2) Scope
- Applicable to any software repository regardless of language, framework, domain, or architecture.
- Explicitly includes legacy stacks (e.g., monolithic Java applications, JSP/Servlet apps, classic server-rendered web apps, jQuery-era front ends).
- Covers discovery from documentation, source code, tests, configuration, and operational artifacts.
- Focuses on story extraction and classification, not implementation estimation or sprint planning.

3) Inputs
- Repository source and directory structure.
- Product docs (README, guides, specs, ADRs, changelogs, roadmaps, issue history).
- Test suites and test names (unit, integration, e2e).
- API/interface definitions (OpenAPI, GraphQL schema, RPC contracts, CLI help).
- Configuration and policy files (auth, permissions, rate limits, feature flags, observability).
- Optional context: commit history and release notes for intent over time.

4) Step-by-Step Workflow
Step 1: Establish context
- Determine product boundary, primary actors, and major capabilities.
- Note assumptions and unknowns to avoid overconfident interpretations.

Step 2: Build a feature inventory
- List user-visible behaviors and externally observable system outcomes.
- Group findings by domain area (e.g., onboarding, data management, reporting, admin).

Step 3: Extract candidate stories
- Translate each behavior into a user-goal statement.
- Prefer outcome language over technical implementation details.
- Inspect user input controls as primary user-story signals: text fields, text areas, radio buttons, checkboxes, select/dropdowns, date pickers, file uploads, submit/reset buttons, links, and form validation/error messages.
- Trace each control to its backend handling path (controller/action/servlet endpoint, business rule, persistence side effects) to infer the underlying user goal and expected outcome.

Step 4: Validate evidence
- Attach at least one evidence source per story (doc, code path, test, API route, config rule).
- Mark confidence level (high/medium/low) based on evidence strength.

Step 5: Classify stories
- Assign functional or non-functional category.
- Tag cross-cutting concerns (security, performance, accessibility, reliability, compliance).

Step 6: Normalize and deduplicate
- Merge duplicates that represent the same user outcome.
- Split overloaded stories into independently testable units.

Step 7: Define acceptance signals
- Add concise acceptance criteria or observable success checks.
- Ensure each story can be verified through behavior, not internal implementation.

Step 8: Publish catalog
- Output a structured table with IDs, story text, classification, evidence, and status.
- Include unresolved questions and recommended follow-up validation.

5) Extraction Checklist
- Is there a clear actor (end user, admin, operator, external system)?
- Is there a clear user goal or desired outcome?
- Is value or benefit stated from the actor perspective?
- Is evidence linked and traceable?
- Is scope bounded enough to test independently?
- Are dependencies or prerequisites identified?
- Are edge cases or error paths represented where relevant?
- Is confidence level assigned?

6) Categorization Guidance
- By actor: customer, admin, support agent, developer, partner system, auditor.
- By journey phase: discover, onboard, configure, transact, monitor, troubleshoot, offboard.
- By capability area: identity, data lifecycle, integrations, billing, reporting, notifications.
- By operation type: create/read/update/delete, approve/reject, import/export, automate/manual.
- By maturity: existing, partial, planned/inferred, deprecated.

7) User Story Format
- Preferred template: As a <actor>, I want <goal>, so that <value>.
- Keep one primary outcome per story.
- Add optional fields: Preconditions, Acceptance Criteria, Evidence, Risks, Open Questions.
- Avoid implementation-specific wording unless required by constraints.

8) Functional vs Non-Functional Classification
Functional stories
- Describe what the system must do for users or external actors.
- Usually map to workflows, commands, API operations, UI actions, or business rules.

Non-functional stories
- Describe how well the system must perform or operate.
- Include performance, security, reliability, accessibility, observability, scalability, compliance.
- Express with measurable targets when possible (latency, uptime, error rate, auditability).

9) Output Table Schema
- Story ID: unique stable identifier.
- Story Statement: user story text.
- Actor: primary role.
- Goal: desired action/outcome.
- Value: user/business benefit.
- Type: Functional or Non-Functional.
- Category Tags: domain/journey/cross-cutting labels.
- Evidence: links/paths to docs, tests, interfaces, or code references.
- Acceptance Signals: observable checks for completion.
- Confidence: high/medium/low.
- Status: confirmed, inferred, needs validation.
- Notes: dependencies, assumptions, open questions.

10) Quality Checks
- Completeness: major actor journeys are represented end-to-end.
- Clarity: stories are understandable by non-authors.
- Testability: acceptance signals are observable and objective.
- Traceability: each story links to concrete evidence.
- Non-overlap: duplicates removed; boundaries between stories are clear.
- Balance: both functional and non-functional needs are captured.

11) Common Pitfalls
- Confusing technical tasks with user stories.
- Writing stories without actor, value, or evidence.
- Overly broad stories that hide multiple outcomes.
- Ignoring non-functional requirements until late stages.
- Treating inferred behavior as confirmed without validation.
- Missing negative paths, permissions, and operational constraints.
- Letting naming drift reduce comparability across stories.

12) Recommended Deliverable Cadence
- Initial pass: fast inventory with confidence labels.
- Second pass: evidence strengthening and deduplication.
- Review pass: stakeholder validation and gap closure.
