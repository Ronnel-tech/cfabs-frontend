# Repository Guidelines

## Project Location & Architecture

This React, TypeScript, Vite, and Tailwind CSS application lives in `Booking-System/frontend/`, beside the LavaLust backend in `Booking-System/Lavalust/`. Keep all backend development in LavaLust, following its MVC architecture, existing utilities, and migrations. Do not introduce another backend framework. These projects will be deployed separately; do not move frontend build output into the backend source tree.

## Commands & Conventions

Run `npm ci`, `npm run dev`, `npm run build`, `npm test`, and `npm run lint` from this frontend directory. Follow `README.md` for backend startup and deployment requirements. Use two-space indentation, single quotes, PascalCase React components, and the existing Oxlint rules. Keep pages in `src/pages/`, reusable UI in `src/components/`, and API/session utilities in `src/lib/`. Reuse design tokens in `src/index.css`.

## Scope, Dependencies & Configuration

Make focused changes without unnecessary rewrites or unrelated refactoring. Inspect only relevant files, reuse prior findings, minimize repeated reads and tool calls, and keep responses concise. Reuse existing methods and dependencies; add maintained React libraries only when they clearly improve the workflow. Never place backend credentials or signing keys in this application. Preserve memory-only token handling and backend permission enforcement. Include validation results and screenshots for visual changes in pull requests.

Apply the following UI/UX rules to every frontend task.
## UI/UX DESIGN & FRONTEND DEVELOPMENT RULES

### 1. Design Philosophy

Act as a Senior UI/UX Designer and Senior Frontend Engineer.

Your responsibility is to build interfaces that look and feel like professionally designed commercial software, not generic AI-generated websites.

Every interface must prioritize:

- Visual hierarchy
- Consistency
- Simplicity
- Usability
- Accessibility
- Responsiveness
- Performance
- Clear user feedback

Never sacrifice usability for visual aesthetics.

Do not immediately start coding UI components. First understand the page's purpose, users, workflows, and existing design system.

### 2. Visual Design Standards

Follow these principles:

#### Layout and Spacing
- Use a consistent spacing scale.
- Maintain proper alignment and balanced whitespace.
- Avoid overcrowded layouts.
- Use appropriate content widths.
- Establish clear visual hierarchy.
- Avoid unnecessary containers and cards.
- Do not place everything inside a card.

#### Typography
- Use a consistent typography system.
- Establish clear heading, body, label, and caption styles.
- Maintain readable font sizes and line heights.
- Use font weights intentionally.
- Avoid excessive font size variations.

#### Colors
- Follow the existing brand identity and design tokens.
- Use semantic colors consistently.
- Maintain sufficient contrast.
- Avoid excessive gradients and unnecessary colorful elements.
- Use colors to communicate meaning, not merely decoration.

#### Components
- Build reusable components.
- Maintain consistent border radii, shadows, spacing, and component sizes.
- Use consistent button styles.
- Establish clear primary, secondary, tertiary, and destructive actions.
- Avoid unnecessary visual complexity.

### 3. Modern Interface Standards

Aim for the quality of professionally designed products such as:

- Linear
- Stripe
- Vercel
- Notion
- Raycast
- Supabase

Use these products as references for their design principles, not as interfaces to blindly copy.

Avoid:
- Generic AI dashboard layouts.
- Excessive rounded cards.
- Random gradients.
- Unnecessary glassmorphism.
- Excessive shadows.
- Oversized headings without purpose.
- Too many accent colors.
- Unnecessary icons.
- Decorative elements that do not improve usability.
- Inconsistent spacing and alignment.

### 4. UX Requirements

Every interface must have a clear and predictable user experience.

Implement appropriate:

- Loading states
- Empty states
- Error states
- Success feedback
- Confirmation dialogs
- Form validation
- Disabled states
- Hover states
- Focus states
- Active states
- Tooltips when necessary

Forms must have:
- Clear labels.
- Helpful placeholders.
- Understandable validation messages.
- Logical field grouping.
- Proper input types.
- Clear submission feedback.

Never leave users wondering whether an action succeeded.

Destructive actions must require appropriate confirmation.

### 5. Responsive Design

All pages must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

Requirements:
- Avoid horizontal overflow.
- Use responsive layouts.
- Adapt navigation for smaller screens.
- Maintain readable typography.
- Make interactive elements touch-friendly.
- Ensure tables and complex layouts remain usable on mobile.

Do not simply shrink the desktop layout. Redesign the layout when necessary.

### 6. Accessibility

Follow accessibility best practices:

- Use semantic HTML.
- Provide accessible labels.
- Maintain sufficient color contrast.
- Support keyboard navigation.
- Provide visible focus indicators.
- Use appropriate ARIA attributes when necessary.
- Do not rely on color alone to communicate information.
- Ensure dialogs and dropdowns are keyboard accessible.

### 7. React and Tailwind Architecture

When developing with React, Vite, and Tailwind CSS:

- Use reusable components.
- Separate UI components from business logic.
- Avoid unnecessarily large components.
- Keep components maintainable.
- Use consistent naming conventions.
- Avoid duplicated styling.
- Use existing project dependencies whenever possible.
- Follow the installed Tailwind CSS version and configuration.
- Respect the existing folder structure.
- Do not introduce unnecessary dependencies.

Create reusable design tokens for:
- Colors
- Typography
- Spacing
- Border radii
- Shadows
- Component dimensions

Do not hardcode inconsistent values throughout the application.

### 8. Interaction and Microinteractions

Interactions should feel intentional and responsive.

Use subtle transitions for:
- Buttons
- Dropdowns
- Navigation
- Dialogs
- Tabs
- Hover states
- Loading indicators

Animations must:
- Be purposeful.
- Be subtle.
- Avoid distracting users.
- Respect reduced-motion preferences.
- Never interfere with usability.

Avoid animating every element.

### 9. Design Before Implementation

Before implementing a page:

1. Understand the purpose of the page.
2. Identify the intended users.
3. Understand the user's primary tasks.
4. Identify the necessary information.
5. Establish the visual hierarchy.
6. Reuse existing design tokens and components.
7. Determine responsive behavior.
8. Implement the interface.

Do not redesign unrelated pages unless requested.

### 10. Quality Assurance

After implementation:

- Review the entire page visually.
- Check spacing and alignment.
- Check typography consistency.
- Check responsive layouts.
- Test interactive elements.
- Verify loading, empty, and error states.
- Check for overflow and layout issues.
- Remove unnecessary visual elements.
- Verify that the implementation follows the existing design system.

Do not consider a page complete merely because it compiles.

### 11. Final Design Quality Standard

Before finishing any UI task, ask yourself:

1. Does this look like production-ready software?
2. Is the visual hierarchy clear?
3. Is the interface easy to understand?
4. Are spacing and alignment consistent?
5. Does every component have a purpose?
6. Are interactions predictable?
7. Does it work on mobile?
8. Does it follow the existing brand identity?
9. Does it avoid generic AI-generated design patterns?

If the answer to any of these is no, improve the implementation before considering the task complete.

**The goal is not simply to make the interface look beautiful. The goal is to create a polished, consistent, accessible, and intuitive product.**

