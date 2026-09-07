# Feature Specification: Cloudflare Turnstile Bot Protection

**Feature Branch**: `026-turnstile-bot-protection`

**Created**: 2026-09-07

**Status**: Draft

**Input**: User description: "Cloudflare Turnstile integration to protect public-facing forms (Signup, Forgot-Password) against bots. The app already has a Cloudflare domain. Frontend is Angular, backend is NestJS. Turnstile widget renders invisibly/minimally, returns a token, backend verifies it via Cloudflare's siteverify API before processing the request. Sign-In is out of scope (rate-limiting covers it). No new npm packages needed."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Signup Form Bot Protection (Priority: P1)

A new visitor attempts to register an account via the public signup form. Turnstile runs silently in the background and issues a challenge token before the form can be submitted. The backend verifies the token before creating the account. Automated scripts that submit the form without a valid token are rejected.

**Why this priority**: The signup form is the highest-risk surface — it is publicly reachable without credentials and is the primary target for bot-driven fake account creation. Protecting it prevents spam registrations and resource abuse.

**Independent Test**: Can be fully tested by submitting the signup form with and without a valid Turnstile token and verifying that only valid-token submissions succeed in creating an account.

**Acceptance Scenarios**:

1. **Given** a visitor opens the signup page, **When** the page loads, **Then** Turnstile initialises automatically without requiring any user interaction.
2. **Given** Turnstile has completed its invisible challenge, **When** the user submits the signup form, **Then** a valid Turnstile token is included in the submission.
3. **Given** a signup request arrives with a valid Turnstile token, **When** the backend processes it, **Then** the account is created normally.
4. **Given** a signup request arrives with a missing or invalid Turnstile token, **When** the backend processes it, **Then** the request is rejected with an appropriate error and no account is created.
5. **Given** Turnstile's external service is unreachable, **When** the backend attempts verification, **Then** the request is rejected with a server-side error (fail-closed behaviour).

---

### User Story 2 - Forgot-Password Form Bot Protection (Priority: P2)

A visitor submits the forgot-password form to trigger a password-reset email. Turnstile runs silently before submission. The backend verifies the token before sending any email. Automated scripts cannot use this form to flood arbitrary email addresses with reset mails.

**Why this priority**: The forgot-password endpoint is a common target for mail-bombing and user-enumeration attacks. Turnstile protection stops bulk automated abuse without adding friction to legitimate users.

**Independent Test**: Can be fully tested by submitting the forgot-password form with and without a valid Turnstile token and verifying that only valid-token submissions trigger the reset email flow.

**Acceptance Scenarios**:

1. **Given** a visitor opens the forgot-password page, **When** the page loads, **Then** Turnstile initialises automatically.
2. **Given** Turnstile has completed its challenge, **When** the user submits the form, **Then** a valid token is included in the submission.
3. **Given** a forgot-password request arrives with a valid token, **When** the backend processes it, **Then** the password-reset flow proceeds as normal.
4. **Given** a forgot-password request arrives with a missing or invalid token, **When** the backend processes it, **Then** the request is rejected and no reset email is sent.

---

### Edge Cases

- What happens when Turnstile fails to load (e.g., ad-blocker, network error)? The form submit button must remain disabled until a token is received; users who cannot load the widget see a guidance message.
- What happens when a Turnstile token expires before the user submits the form? Turnstile automatically refreshes expired tokens; the frontend must handle the refresh callback and update the stored token.
- What if the Cloudflare siteverify API returns an unexpected response format? The backend must treat any non-`success: true` response as a failed verification.
- What if a user submits the form multiple times in quick succession (double-click)? The same token must not be reusable; Cloudflare's siteverify API rejects already-used tokens, so the second submission is rejected automatically.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The signup form MUST NOT be submittable unless a valid Turnstile token has been obtained.
- **FR-002**: The forgot-password form MUST NOT be submittable unless a valid Turnstile token has been obtained.
- **FR-003**: The Turnstile widget MUST initialise automatically on page load with no required user interaction (invisible/managed mode).
- **FR-004**: The frontend MUST include the Turnstile token in the request payload when submitting either protected form.
- **FR-005**: The backend MUST verify the Turnstile token against Cloudflare's siteverify endpoint before executing any business logic for the protected endpoints.
- **FR-006**: The backend MUST reject requests with missing, invalid, or already-used Turnstile tokens with a clear error response.
- **FR-007**: The backend MUST behave fail-closed: if the siteverify call cannot be completed (network error, timeout), the request MUST be rejected.
- **FR-008**: The Turnstile site key MUST be configurable via environment variable (not hard-coded).
- **FR-009**: The Turnstile secret key MUST be stored only on the backend and MUST be configurable via environment variable.
- **FR-010**: The sign-in form is explicitly OUT OF SCOPE for this feature.

### Key Entities

- **TurnstileToken**: A short-lived, single-use string issued by the Turnstile widget on the frontend, verified by the backend via the siteverify API. Has no persistent storage in the application database.
- **TurnstileVerificationResult**: The outcome returned by Cloudflare's siteverify API (`success`, `error-codes`). Consumed transiently by the backend; not persisted.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Automated form submissions that do not include a valid Turnstile token are rejected 100% of the time on both protected forms.
- **SC-002**: Legitimate users can complete the signup and forgot-password flows without any additional manual challenge steps (invisible widget).
- **SC-003**: The Turnstile widget adds no more than 500 ms to the perceived page-load time of the signup or forgot-password page under normal network conditions.
- **SC-004**: Backend verification of a Turnstile token completes in under 2 seconds under normal conditions.
- **SC-005**: All secrets (Turnstile secret key) are absent from frontend bundles, client-side code, and version control.

## Assumptions

- The Cloudflare account linked to the project's domain has Turnstile enabled (free tier; no cost for unlimited verifications).
- Both protected forms are fully server-rendered or submitted as standard HTTP/XHR requests — the token can be appended to the existing request body without restructuring the form submission flow.
- The Turnstile widget is loaded from Cloudflare's CDN via a `<script>` tag in the host HTML file; no additional npm package is required.
- "Invisible/managed" Turnstile mode is preferred so that users with no suspicious signals see no visible widget or interaction prompt.
- The backend already has an HTTP client available for outbound requests (e.g., to call the siteverify API); no new networking library is needed.
- Fail-closed is the accepted behaviour for external service unavailability (siteverify unreachable = request rejected), accepting the rare false-positive over the risk of bypassed verification.
- Sign-in protection is intentionally excluded from this feature; existing or future rate-limiting at the backend layer is sufficient for that endpoint.
