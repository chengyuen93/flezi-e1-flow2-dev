---
name: local-mr-review
description: review local git changes on the current branch that have not been pushed to its upstream branch, including unpushed commits, staged changes, unstaged changes, and untracked source files. use when the user asks for a local mr review, pre-push review, branch review, or review of current unpushed work. produce a report only; never edit files, apply patches, commit, push, post comments, or otherwise modify the repository.
---

# Local MR Review

Review only the current branch's local work that has not reached its configured upstream. Include committed and uncommitted work. Produce a report without modifying the repository.

## Non-negotiable rules

- Run only read-only inspection commands.
- Never edit files, apply fixes, stage, commit, reset, checkout, clean, fetch, pull, push, or post comments.
- Do not review pre-existing upstream code unless needed to understand the changed lines.
- Report only actionable findings introduced or exposed by the reviewed changes.
- Do not invent issues. If evidence is insufficient, label it as a question rather than a defect.
- Respect repository-wide and path-specific instructions, but this skill's report-only and non-mutation rules take precedence.

## Workflow

### 1. Establish the review scope

Run these read-only commands:

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
```

Treat the configured upstream as the remote baseline. Do not fetch automatically because fetching changes repository metadata and can alter the meaning of "not yet pushed".

If no upstream is configured, stop and report that the unpushed committed range cannot be determined reliably. You may still summarize staged, unstaged, and untracked changes, but clearly mark the review as incomplete. Do not guess a baseline such as `main`.

Determine committed changes that are ahead of upstream:

```bash
git log --oneline --decorate '@{upstream}..HEAD'
git diff --stat '@{upstream}...HEAD'
git diff --find-renames --find-copies '@{upstream}...HEAD'
```

Inspect staged and unstaged changes separately:

```bash
git diff --cached --stat
git diff --cached --find-renames --find-copies
git diff --stat
git diff --find-renames --find-copies
```

List untracked files with `git ls-files --others --exclude-standard`. Inspect untracked source, configuration, migration, and test files that are part of the work. Do not open likely secrets, generated output, dependency directories, binaries, or large artifacts. Flag suspicious secret-like filenames without displaying their contents.

The effective review scope is the union of:

1. `@{upstream}...HEAD` for unpushed commits.
2. The index for staged changes.
3. The working tree for unstaged changes.
4. Relevant untracked files.

Avoid double-counting a line that appears in more than one view. When understanding the final local state is important, inspect the current file and compare it with the upstream version.

### 2. Understand intent and context

- Read repository instructions such as `.github/copilot-instructions.md`, applicable `.github/instructions/*.instructions.md`, and the nearest applicable `AGENTS.md`.
- Read changed files and only the adjacent code required to understand contracts, callers, models, tests, and error paths.
- Infer intent from branch name, unpushed commit messages, tests, and changed code.
- If intent remains materially ambiguous, include targeted questions in the report. Do not block the review unless the ambiguity makes a finding impossible to assess.

### 3. Review by priority

Review in this order:

1. **Functional correctness and edge cases**: incorrect logic, broken state transitions, null/empty handling, boundary conditions, race conditions, retries, idempotency, and partial failure.
2. **Security and authorization**: authentication, authorization, tenant or ownership checks, injection, unsafe deserialization, validation, secret exposure, sensitive logging, and insecure defaults.
3. **API and database backward compatibility**: breaking contracts, schema evolution, migration safety, rollback compatibility, data loss, locks, indexes, and mixed-version deployment behavior.
4. **Error handling and concurrency**: swallowed exceptions, misleading status codes, non-atomic updates, deadlocks, duplicate processing, timeout and cancellation handling.
5. **Performance**: N+1 queries, unbounded scans, repeated network or disk work, memory growth, blocking operations, and missing pagination or limits.
6. **Test completeness**: missing regression coverage, weak assertions, absent failure-path tests, flaky timing assumptions, and tests that do not exercise the changed behavior.
7. **Maintainability and unnecessary complexity**: duplication, overly broad changes, unclear contracts, unreachable code, or needless abstraction. Do not report subjective style preferences already handled by linters or formatters.
8. **Frontend or mobile state handling where applicable**: loading, empty, error and retry states; stale state; lifecycle cleanup; accessibility; navigation consistency; offline behavior and platform differences.

### 4. Validate findings

For every potential finding:

- Trace a concrete execution path or data flow from changed code to impact.
- Confirm the issue exists in the final local state, not only in an intermediate commit.
- Check nearby guards, callers, tests, framework behavior, and repository conventions before reporting it.
- Cite the file and precise line or smallest useful range from the current working tree.
- Explain a realistic trigger and consequence.
- Recommend the smallest practical fix without applying it.

Classify severity as:

- **Blocking**: likely security vulnerability, data loss/corruption, major functional failure, or clear backward-incompatible break that should prevent merge.
- **Important**: meaningful correctness, reliability, performance, compatibility, or test gap that should normally be fixed before merge.
- **Suggestion**: worthwhile low-risk improvement that is not required for correctness.
- **Question**: missing product or architectural context prevents a reliable judgment.

Do not inflate severity. Consolidate duplicate symptoms under one root-cause finding.

### 5. Tests and static checks

Inspect relevant test and build configuration. Do not run commands that modify tracked files, install dependencies, update lockfiles, start services, or require credentials.

Run existing targeted checks only when they are clearly read-only and dependencies are already available. Prefer the narrowest relevant tests. If safety is unclear, do not run them; list them as recommended validation instead.

Never claim a check passed unless its command completed successfully. Record command failures and environmental limitations separately from code findings.

## Report format

Use this structure:

```markdown
# Local MR Review

## Scope
- Branch: `<branch>`
- Upstream baseline: `<upstream>`
- Unpushed commits: `<count and short list>`
- Included: `<committed/staged/unstaged/untracked summary>`
- Review completeness: `<complete or limitation>`

## Verdict
`Ready to push` | `Ready after fixes` | `Needs clarification`

<2-4 sentence summary of risk and the most important result.>

## Findings

### [Blocking|Important|Suggestion|Question] Short actionable title
- **Location:** `path/to/file:line-range`
- **Why it matters:** <impact>
- **Trigger:** <specific scenario>
- **Evidence:** <concise reasoning tied to changed code>
- **Recommended fix:** <smallest practical correction>

## Validation
- Checks run: `<commands and outcomes>`
- Not run: `<checks and why>`

## Positive observations
- <Briefly note effective tests, safe compatibility handling, or well-contained design. Omit if none.>

## Recommended next steps
1. <Ordered action>
```

If there are no findings, state: **No actionable findings identified in the reviewed local changes.** Still document scope, limitations, and validation. Do not imply the code is defect-free.