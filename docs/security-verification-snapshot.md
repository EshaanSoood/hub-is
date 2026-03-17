# Security Verification Snapshot

## Verified by Automation Now

- Runtime authorization matrix via `scripts/check-authz-runtime.mjs` (owner/member/non-member, owner-only route enforcement, and project-scope isolation checks).
- Nextcloud path safety verification:
  - API-side Nextcloud path validation for list/download/delete/upload path inputs.
  - Live negative assertion in `scripts/check-nextcloud-live.mjs` for traversal input (`path=../`) expecting `400 {"error":"invalid_path"}`.

## Verified by Manual QA Now

- Accessibility manual QA checklist in `docs/a11y-manual-qa.md` for keyboard-only flow, focus handling, live announcements, landmarks/skip link, and Lexical editor SR behavior.

## Deferred to Hardening Sprint

- Rate limiting design and enforcement.
- CSRF posture review (token and cookie strategy verification).
- SQL injection audit and query-surface review.
- Sanitization/XSS hardening review beyond current checks.
- Security header and browser policy tightening.
- Secret lifecycle controls (rotation cadence, revocation drills, least-privilege review).
- Additional threat-model driven controls and abuse-case testing.
