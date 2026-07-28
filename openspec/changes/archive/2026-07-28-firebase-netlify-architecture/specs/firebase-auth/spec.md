## ADDED Requirements

### Requirement: Firebase Authentication with Google sign-in
The system SHALL use Firebase Authentication for user identity. Users SHALL sign in with their Google account via `signInWithPopup` (desktop) or `signInWithRedirect` (mobile). No server-side OAuth flow is required.

#### Scenario: User signs in with Google
- **WHEN** user clicks "Sign in with Google" on the login page
- **THEN** Firebase Auth SHALL open a Google sign-in popup
- **AND** on success the user SHALL be redirected to the dashboard

#### Scenario: Auth state persists across page reloads
- **WHEN** a signed-in user reloads the page
- **THEN** `onAuthStateChanged` SHALL fire with the user object before any protected content renders
- **AND** no redirect to login SHALL occur

### Requirement: Auth guard on all app routes
The system SHALL protect all routes except `/login` behind an auth check using `onAuthStateChanged`. Unauthenticated users SHALL be redirected to `/login`.

#### Scenario: Unauthenticated user visits protected route
- **WHEN** an unauthenticated user navigates to `/study`
- **THEN** the system SHALL redirect to `/login`

#### Scenario: Authenticated user visits login page
- **WHEN** an authenticated user navigates to `/login`
- **THEN** the system SHALL redirect to `/`

### Requirement: Auth restricted to allowed email addresses
The system SHALL check the signed-in user's email against a configured `VITE_ALLOWED_EMAIL` environment variable. If the email does not match, the system SHALL sign the user out and show an "access denied" message on the login page.

#### Scenario: Unauthorized email rejected after sign-in
- **WHEN** a user signs in with a Google account whose email does not match `VITE_ALLOWED_EMAIL`
- **THEN** Firebase Auth SHALL sign out the user immediately
- **AND** the login page SHALL display "Access denied: unauthorized email"

#### Scenario: `VITE_ALLOWED_EMAIL` not set allows any Google account
- **WHEN** `VITE_ALLOWED_EMAIL` is empty or not set
- **THEN** any Google account SHALL be permitted to sign in

### Requirement: Sign out clears Firebase Auth session
The system SHALL provide a sign-out button that calls `signOut(auth)`. After sign-out the user SHALL be redirected to `/login`.

#### Scenario: User signs out
- **WHEN** user clicks the sign-out button in the sidebar
- **THEN** `signOut(auth)` SHALL be called
- **AND** the user SHALL be redirected to `/login`
- **AND** subsequent page reloads SHALL show the login page

### Requirement: Loading state while auth resolves
The system SHALL show a loading indicator while the initial `onAuthStateChanged` event has not yet fired. No redirect SHALL occur during the loading state.

#### Scenario: App shows loading until auth state known
- **WHEN** the app first loads
- **THEN** a loading screen SHALL render until `onAuthStateChanged` fires
- **AND** no route redirect SHALL occur before auth state is resolved
