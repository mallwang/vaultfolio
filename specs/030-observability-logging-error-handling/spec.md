# Feature Specification: Observability — Structured Logging & Consistent Error Handling

**Feature Branch**: `031-observability-logging`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Formalize specs/030-observability-logging-error-handling/plan.md — a backend and frontend integration plan for structured request logging, a consistent error-response contract with a traceable correlation ID, a business-exception hierarchy, and centralized frontend error handling — into a feature specification."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trace a reported error back to its cause (Priority: P1)

A user reports "something went wrong" while using the app (e.g., during signup, an account action, or a data export). Support or an on-call engineer needs to find the exact backend event that caused it, without asking the user to reproduce the problem or share sensitive details.

**Why this priority**: This is the core value of the feature — without a reliable way to connect a user-visible failure to its backend cause, every other improvement (structured logs, categorized errors) is much less useful. It also touches every other flow in the app, since every request can fail.

**Independent Test**: Trigger any backend error (e.g., submit an invalid request) and confirm the error shown to the user carries a reference identifier that also appears on the corresponding backend log entry, and that the two can be matched without any other information.

**Acceptance Scenarios**:

1. **Given** a request to the backend fails for any reason, **When** the error response reaches the caller, **Then** the response includes a reference identifier that also appears on the backend's own log entry for that request.
2. **Given** a user is shown a generic "something went wrong" message in the app, **When** they or support staff report the reference identifier, **Then** staff can locate the exact backend log entry for that failure.
3. **Given** a client includes its own request-tracing identifier when calling the backend, **When** the backend processes the request, **Then** the response and logs reuse that same identifier rather than generating an unrelated one (unless the supplied identifier is malformed, in which case a new one is generated).

---

### User Story 2 - Diagnose and monitor system health from logs alone (Priority: P1)

An engineer investigating a production issue (elevated errors, a slow endpoint, a suspicious pattern of failures) needs to reconstruct what happened from logs alone, including which requests succeeded, which failed, why, and how severe each failure was — without access to a live debugger or the ability to reproduce the issue.

**Why this priority**: Equal in importance to Story 1 — this is the other half of the same problem (production visibility). Without consistent lifecycle logging and severity classification, engineers cannot tell routine client mistakes (e.g., a bad login) apart from genuine system failures, and cannot set up alerting or dashboards on top of the logs.

**Independent Test**: Send a mix of successful requests, expected client-caused failures (e.g., invalid input, unauthorized access), and a forced unexpected server failure, then confirm the logs alone show which happened when, how long each took, and a severity level that correctly distinguishes routine failures from unexpected ones.

**Acceptance Scenarios**:

1. **Given** any request reaches the backend, **When** it completes (successfully or not), **Then** a log entry exists recording the outcome, timing, the endpoint involved, and (when the caller is authenticated) who made the request.
2. **Given** a request fails because of an expected, client-caused condition (e.g., invalid input, a resource that doesn't exist, insufficient permissions), **When** the failure is logged, **Then** it is marked at a lower severity than a genuinely unexpected failure.
3. **Given** a request fails because of an unexpected error or an unhandled exception, **When** the failure is logged, **Then** it is marked at a severity that would draw an engineer's attention, and the full technical detail (e.g., stack trace) is present in the log but never sent to the caller.
4. **Given** a background/process-level failure occurs that isn't tied to any single request (e.g., an unhandled promise rejection), **When** it happens, **Then** it is still captured in the logs rather than silently lost.

---

### User Story 3 - See a helpful message instead of a broken screen (Priority: P2)

A user of the web app encounters an error that the specific page or action didn't anticipate (a truly unexpected failure, not one of the app's known/handled error cases). Today this can leave the screen blank, frozen, or silently non-functional. Instead, the user should see a clear, non-blocking message telling them something went wrong, with enough information to report it if needed.

**Why this priority**: Important for user trust and support efficiency, but it is a safety net for cases the app's existing, more specific error handling doesn't already cover — so it depends on Stories 1 and 2 being in place to be useful (the reference id it displays only has value once the backend can look it up).

**Independent Test**: Force an error that no part of the app currently handles explicitly (e.g., an unexpected 500 response, or a client-side script error), and confirm the user sees a generic, non-blocking notification instead of a silently broken page, and that existing handled error cases (e.g., "that invite code is invalid") are unaffected and continue to show their existing specific messages.

**Acceptance Scenarios**:

1. **Given** a backend call fails in a way the calling screen does not specifically handle, **When** the failure occurs, **Then** the user sees a generic, dismissible notification rather than a silent failure or a broken screen.
2. **Given** a backend call fails in a way the calling screen already handles specifically (e.g., a known validation message), **When** the failure occurs, **Then** the existing specific message is shown exactly as it is today, and the generic fallback notification does not also appear.
3. **Given** an error occurs entirely within the app in the user's browser (not from a backend call), **When** it happens, **Then** it is caught, logged, and shown to the user as a non-blocking notification rather than leaving the page unresponsive.

---

### User Story 4 - Consistent, categorized failures across every feature (Priority: P3)

A developer working on any backend feature needs a small, consistent set of ways to signal common failure situations (a resource that doesn't exist, a conflicting state, a permission problem, a failed call to an outside service, being rate-limited, a business-rule validation failure) so that every feature reports these situations the same way, instead of each one inventing its own error shape or reusing generic framework errors that don't carry enough meaning.

**Why this priority**: This is a foundation/consistency improvement that makes Stories 1–3 easier to build on for every future feature, but the app functions today without it (existing features already work, just inconsistently) — so it's valuable but lower urgency than closing the tracing and visibility gaps above.

**Independent Test**: Pick two existing features that currently fail in ad hoc ways (e.g., a bot-verification failure, a permission check) and confirm both now report through the same small set of categorized failure types, with no change to the error information already relied on by the app.

**Acceptance Scenarios**:

1. **Given** a request references something that doesn't exist, **When** the backend rejects it, **Then** the failure is categorized consistently as "not found," the same way regardless of which feature raised it.
2. **Given** a request is rejected because the caller lacks permission, **When** the backend rejects it, **Then** the failure is categorized consistently as "access denied," the same way regardless of which feature raised it.
3. **Given** a call to an outside service the backend depends on fails or times out, **When** the backend reports this to the caller, **Then** the caller receives a safe, generic "external service failed" style error — never the raw error from the outside service — while the full detail is available in the backend's own logs.
4. **Given** existing app screens already look for specific values in today's error responses, **When** any of these categorized failures occur, **Then** those existing checks keep working unchanged.

---

### Edge Cases

- What happens when a client supplies a tracing/correlation identifier that is malformed, excessively long, or contains unexpected characters? → It must not be trusted as-is (to prevent log forgery or corruption); the system generates its own instead.
- What happens when the error-handling mechanism itself fails while trying to process another failure? → The caller must still receive a safe, generic error response rather than getting no response at all or an unhandled crash.
- What happens when the logging mechanism itself fails (e.g., cannot write a log entry)? → The request/response cycle must still complete normally for the caller; a logging failure must not become a user-facing failure.
- What happens to sensitive data (credentials, session/auth tokens, full request bodies) that might otherwise end up in a log entry? → It must never be written to logs, structured or otherwise.
- How does the system behave for the existing health-check endpoint, which intentionally reports unhealthy status without raising an error? → It must continue to work exactly as it does today; the new error handling must not intercept or alter its responses.
- What happens when a user is not authenticated at the time of a failure? → The failure is still logged and given a reference identifier; only the "who made the request" field is absent.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST assign a unique reference identifier to every backend request, reusing a client-supplied tracing identifier when one is present and well-formed, and generating a new one otherwise.
- **FR-002**: The system MUST include this reference identifier in every error response returned to a caller, and MUST make it retrievable from the corresponding backend log entry.
- **FR-003**: The system MUST echo the reference identifier back to the caller (e.g., via a response header) so that clients and browser tooling can capture it independent of the response body.
- **FR-004**: The system MUST log the start, successful completion, and failure of every backend request in a structured, machine-parseable format, including at minimum: the reference identifier, the endpoint/action involved, timing, outcome, and the identity of the caller when authenticated.
- **FR-005**: The system MUST classify the severity of each logged failure according to its cause: routine, expected client-caused failures (e.g., invalid input, not found, access denied) MUST be logged at a lower severity than unexpected or system-caused failures.
- **FR-006**: The system MUST NOT include internal technical detail (e.g., stack traces, raw exception messages from internal or third-party systems) in any response sent to a caller; such detail is only ever recorded in server-side logs.
- **FR-007**: The system MUST provide a small, consistent set of categorized failure types covering at least: resource not found, business-rule validation failure, conflicting state, access denied, failure of a dependent outside service, and rate limiting — usable consistently across all backend features.
- **FR-008**: The system MUST preserve every existing error-response field's name and meaning for currently-integrated callers; any new information (such as the reference identifier) MUST be additive and MUST NOT require existing callers to change to keep working.
- **FR-009**: The system MUST sanitize any externally supplied value (such as header or URL values) before it is written to a log entry, so that it cannot be used to forge, corrupt, or inject additional fabricated log entries.
- **FR-010**: The system MUST NOT write sensitive information — including authentication credentials, session tokens, and full request bodies — to any log entry.
- **FR-011**: The frontend MUST show a generic, non-blocking notification to the user when a backend call fails in a way the calling screen does not already handle specifically, instead of allowing the failure to pass silently or break the screen.
- **FR-012**: The frontend MUST NOT show the generic fallback notification for a failure the calling screen already handles and displays specifically; existing specific error messages MUST continue to display unchanged.
- **FR-013**: The frontend MUST display the reference identifier (when the backend supplied one) as part of the generic fallback notification, so a user can report it.
- **FR-014**: The frontend MUST catch errors that occur entirely within the running app (not from a failed backend call), log them, and present a non-blocking notification rather than leaving the page unresponsive or broken.
- **FR-015**: A failure inside the system's own error-handling or logging mechanism MUST NOT prevent the original request from receiving a response, and MUST NOT crash the application.
- **FR-016**: The system MUST capture and log failures that occur outside the lifecycle of any single request (e.g., unexpected background failures), so they are not silently lost.
- **FR-017**: The existing health-check capability MUST continue to report its status exactly as it does today; the new error-handling behavior MUST NOT intercept, alter, or wrap its responses.

### Key Entities

- **Error Response**: What a caller receives when a request fails. Carries the existing stable, human- and machine-readable failure information already relied on today, plus the reference identifier and, where applicable, a structured list of field-level validation problems.
- **Request Log Entry**: A structured record of one request's lifecycle (start, completion, or failure), carrying the reference identifier, timing, outcome, severity, endpoint, and caller identity when known.
- **Categorized Failure**: One of a small, fixed set of business-level failure kinds (not found, validation failure, conflict, access denied, external service failure, rate limit) that any backend feature can raise, each mapping to a well-known response shape and severity.
- **Reference/Correlation Identifier**: A unique value shared by a request's response and its log entries, used to connect a user- or support-reported problem back to its cause.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every error response returned by the backend, across 100% of endpoints, carries a reference identifier that also appears on the matching backend log entry.
- **SC-002**: An engineer investigating a specific user-reported failure can locate the exact corresponding backend log entry using only the reference identifier shown to the user, with no additional reproduction steps.
- **SC-003**: 100% of requests reaching the backend produce a logged outcome (success or failure) with a severity that correctly distinguishes routine client-caused failures from unexpected system failures.
- **SC-004**: No stack trace, internal exception detail, or raw third-party error text ever appears in a response body sent to a caller, verified across all categorized failure types.
- **SC-005**: All currently existing frontend error-handling checks (e.g., screens that key off a specific known failure code) continue to function without modification after this feature ships.
- **SC-006**: A previously silent or broken-screen failure path (an error not already specifically handled by its screen) instead shows the user a clear, non-blocking notification, verified for at least one such path per major app area.
- **SC-007**: No credential, session/auth token, or full request body ever appears in a log entry, verified by inspecting logs generated from a representative set of test requests including authenticated calls.
- **SC-008**: A forced failure inside the error-handling or logging path itself still results in the caller receiving a valid (if generic) error response, rather than no response or a crash.

## Assumptions

- This feature covers the existing backend application and the existing web frontend application only; it does not introduce a service mesh, distributed tracing across multiple backend services, or any new alerting/paging infrastructure, since none of that exists in this system today.
- The existing error-response contract's current fields (the stable failure code and human-readable message already used throughout the frontend) are treated as fixed and must not change shape; only additive fields are introduced.
- "Reference identifier" reuses a client-supplied tracing header when present and valid, following the same pattern as common HTTP tracing conventions (e.g., a `X-Correlation-Id`-style header), but a malformed or absent one is not treated as an error — the system simply generates its own.
- Calls to outside services that the backend already depends on (at minimum, the bot-verification check used during signup) are in scope for the "external service failure" categorized failure; other outbound integrations discovered during implementation should be evaluated for the same treatment as they're found, without expanding the visible scope of this specification.
- The existing structured logging capability already in place is assumed to remain the system's log output mechanism; this feature extends what is logged and how consistently, not where logs are sent.
- No new user-facing settings or opt-outs are introduced; the generic fallback notification and structured logging apply uniformly to all users and all requests.
- The existing health-check endpoint's intentional pattern of reporting status without raising an error is out of scope for change and must be explicitly preserved.
