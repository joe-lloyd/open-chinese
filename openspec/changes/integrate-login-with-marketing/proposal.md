## Why

The current sign-in screen looks like a separate utility rather than the front door to OpenChinese: its narrow, left-heavy composition, minimal branding, and lack of product context break continuity with the marketing site. A cohesive sign-in experience is needed before paid acquisition or checkout sends more visitors through this transition.

## What Changes

- Rebuild `/login` as a responsive, marketing-integrated page using the shared OpenChinese visual tokens, wordmark, typography, surfaces, and navigation language.
- Add a balanced product panel/banner that explains the learning loop and gives the page visual character without inventing unverifiable usage claims.
- Keep the Google sign-in action visually primary and preserve all existing Firebase authentication, redirect, allowlist, loading, and error behavior.
- Add accessible focus, status, error, motion, contrast, and small-screen behavior.
- Add targeted component tests and a visual QA checklist for desktop and mobile layouts.

## Capabilities

### New Capabilities

- `marketing-integrated-login`: Defines brand continuity, responsive layout, product context, accessibility, and interaction requirements for the sign-in experience.

### Modified Capabilities

- `firebase-auth`: Clarifies how loading, errors, and the Google sign-in action must surface inside the redesigned login experience without changing the authentication contract.

## Impact

- Affects `apps/app/src/pages/LoginPage.tsx`, app-level styling, and login-related tests.
- Reuses `@open-chinese/tokens` and the marketing site's existing brand language; no new design-system dependency is required.
- Does not change Firebase configuration, OAuth scopes, protected-route behavior, or server APIs.
