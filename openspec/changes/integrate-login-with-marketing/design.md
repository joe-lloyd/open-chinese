## Context

`LoginPage.tsx` currently renders a narrow authentication card in a full-screen app surface. It uses shared color tokens but not the marketing site's recognizable header, wordmark, spacious layout, feature language, or layered visual treatment. The auth page must remain a client-side Firebase entry point and must work before any user state exists.

The relevant design source of truth is the existing Astro marketing header and global token package. The implementation should borrow its visual grammar, not import Astro components into React or duplicate an entire navigation system.

## Goals / Non-Goals

**Goals:**

- Make navigation from the marketing site into sign-in feel like one OpenChinese product.
- Produce a balanced desktop composition and a deliberate mobile layout.
- Keep sign-in obvious, trustworthy, accessible, and fast.
- Preserve every existing authentication and authorization behavior.
- Use reusable, testable React structure instead of a single oversized page component.

**Non-Goals:**

- Adding email/password, account creation forms, new OAuth providers, or onboarding.
- Changing Firebase settings, the email allowlist, route guards, or post-auth destinations.
- Claiming user counts, ratings, or outcomes that the product cannot substantiate.
- Sharing framework-specific components between Astro and React.

## Decisions

### Use a branded two-zone composition on wide screens

The page will contain a marketing-style header followed by a centered shell with a product-story panel and a sign-in panel. The product panel carries a subtle decorative Hanzi composition, a concise promise, and three real product benefits; the auth panel contains the existing sign-in flow. At tablet/mobile widths the auth panel appears first after the introductory copy and the supporting material collapses beneath it.

Alternative: a larger centered auth card with only a background illustration. This improves symmetry but still fails to explain the product or create continuity with the marketing site's content hierarchy.

### Recreate the small brand header in React with shared tokens

The login header will use the same `中 OpenChinese` wordmark treatment, a “Back to home” link, and a lightweight “Explore features” link. Values come from `@open-chinese/tokens`; markup stays local to the React app to avoid an Astro/React coupling.

Alternative: iframe or package a cross-framework header. That adds routing, hydration, and release coupling for a page that needs only a small stable subset.

### Preserve auth logic and isolate visual components

The Google action, loading state, error string, and redirect behavior remain wired to the existing auth functions. Presentational pieces such as the brand mark, benefit list, and auth card will be locally extracted when that improves testability, but auth state will not be reimplemented.

### Treat auth feedback as status content

Loading uses a disabled action with an inline progress indicator; sign-in errors render in an `aria-live="polite"` status region associated with the action. Focus remains visible, pointer targets remain at least 44px, decorative glyphs are hidden from assistive technology, and reduced-motion preferences disable nonessential transitions.

## Risks / Trade-offs

- [Marketing and app styles drift later] → Reuse semantic tokens and document the handful of shared brand conventions in tests instead of copying raw colors.
- [Supporting content competes with sign-in] → Keep one primary action, limit copy length, and use visual hierarchy rather than multiple CTA buttons.
- [Mobile order pushes the action below the fold] → Put the sign-in panel before secondary proof points at narrow breakpoints and test at 320px width.
- [Decorative Chinese characters are announced] → Mark all ornamental glyphs `aria-hidden`.

## Migration Plan

Ship as a client-only page replacement with no data migration. Validate both authorized and unauthorized Google accounts in Firebase's test environment. Roll back by reverting `LoginPage` and its tests; authentication state and routes are unaffected.

## Open Questions

None. Marketing links resolve from the existing public-site URL convention, and authenticated users continue to redirect to the dashboard.
