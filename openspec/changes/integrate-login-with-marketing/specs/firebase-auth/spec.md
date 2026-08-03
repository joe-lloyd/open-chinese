## MODIFIED Requirements

### Requirement: Firebase Authentication with Google sign-in
The system SHALL use Firebase Authentication for user identity. Users SHALL sign in with their Google account via `signInWithPopup` (desktop) or `signInWithRedirect` (mobile). The Google sign-in action SHALL remain the visually primary action in the redesigned authentication panel, and its pending and failure states SHALL be visible without shifting the page into a different layout. No server-side OAuth flow is required.

#### Scenario: User signs in with Google
- **WHEN** user clicks "Sign in with Google" on the login page
- **THEN** Firebase Auth SHALL open a Google sign-in popup
- **AND** on success the user SHALL be redirected to the dashboard

#### Scenario: Sign-in is pending
- **WHEN** a Google sign-in attempt is in progress
- **THEN** the sign-in action SHALL be disabled against duplicate submission
- **AND** SHALL communicate its pending state visually and to assistive technology

#### Scenario: Sign-in fails
- **WHEN** Firebase rejects or cancels a sign-in attempt
- **THEN** the authentication panel SHALL remain visible
- **AND** SHALL present an actionable error in a live status region

#### Scenario: Auth state persists across page reloads
- **WHEN** a signed-in user reloads the page
- **THEN** `onAuthStateChanged` SHALL fire with the user object before any protected content renders
- **AND** no redirect to login SHALL occur

### Requirement: Loading state while auth resolves
The system SHALL show a branded loading indicator within the login/app visual system while the initial `onAuthStateChanged` event has not yet fired. No redirect or interactive sign-in action SHALL occur during the loading state, and the loading status SHALL be exposed to assistive technology.

#### Scenario: App shows loading until auth state known
- **WHEN** the app first loads
- **THEN** a branded loading screen or panel SHALL render until `onAuthStateChanged` fires
- **AND** no route redirect SHALL occur before auth state is resolved
- **AND** the loading status SHALL be announced without repeatedly stealing focus
