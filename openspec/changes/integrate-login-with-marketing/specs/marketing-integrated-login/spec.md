## ADDED Requirements

### Requirement: Login visually belongs to OpenChinese
The login page SHALL use the shared OpenChinese brand mark, semantic color and typography tokens, rounded surface treatment, and marketing-site navigation language. It SHALL provide links back to the public home and feature pages without presenting itself as a separate product or domain.

#### Scenario: Visitor arrives from marketing
- **WHEN** an unauthenticated visitor opens `/login`
- **THEN** the page SHALL identify itself as OpenChinese with the same wordmark and visual token system as the marketing site
- **AND** SHALL offer a link back to the public home

#### Scenario: Brand navigation uses normal links
- **WHEN** the visitor activates the brand, home, or feature link
- **THEN** navigation SHALL use the configured public-site URLs
- **AND** SHALL NOT require Firebase authentication

### Requirement: Login composition is balanced and responsive
The login page SHALL present product context and authentication as a balanced two-zone composition on wide viewports. On narrow viewports it SHALL use a single-column order that keeps the value proposition and sign-in action visible before secondary supporting content, with no horizontal overflow at 320 CSS pixels.

#### Scenario: Wide desktop layout
- **GIVEN** a viewport at least 1024 CSS pixels wide
- **WHEN** the login page renders
- **THEN** the product-story and authentication zones SHALL occupy a centered, visually balanced layout
- **AND** neither zone SHALL appear stranded against one edge of the viewport

#### Scenario: Narrow mobile layout
- **GIVEN** a viewport 320 CSS pixels wide
- **WHEN** the login page renders
- **THEN** content SHALL form a readable single column
- **AND** the sign-in action SHALL appear before secondary proof points
- **AND** no content SHALL overflow horizontally

### Requirement: Product context is truthful and useful
The supporting panel SHALL explain real OpenChinese capabilities using concise product language, including structured HSK learning, graded reading, and progress-aware practice. It SHALL NOT display fabricated testimonials, ratings, learner counts, or outcome claims.

#### Scenario: Visitor evaluates the product
- **WHEN** the visitor reads the supporting panel
- **THEN** it SHALL describe at least three capabilities that exist in the product
- **AND** SHALL contain no unverifiable social-proof number

### Requirement: Login is accessible and resilient
All interactive controls SHALL expose visible keyboard focus, pointer targets of at least 44 by 44 CSS pixels, sufficient token-based contrast, and semantic accessible names. Decorative Hanzi SHALL be hidden from assistive technology, status/error feedback SHALL be announced, and nonessential animation SHALL respect `prefers-reduced-motion`.

#### Scenario: Keyboard-only sign-in
- **WHEN** a visitor navigates the page using only a keyboard
- **THEN** every link and the Google sign-in action SHALL receive a visible focus indicator in logical order

#### Scenario: Screen reader encounters decoration and error
- **GIVEN** a decorative Hanzi background and a sign-in error are present
- **WHEN** a screen reader traverses the page
- **THEN** the decorative glyphs SHALL not be announced
- **AND** the error SHALL be announced through a live status region

#### Scenario: Reduced-motion preference
- **GIVEN** the visitor prefers reduced motion
- **WHEN** the page renders or an interactive state changes
- **THEN** nonessential transforms and transitions SHALL be disabled
