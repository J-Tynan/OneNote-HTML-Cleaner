<!-- markdownlint-disable MD032 -->

# Homepage UX Research

Status
- Research document for pre-implementation homepage UX redesign work.
- Intended audience: product strategy, UX planning, implementation planning, and review.
- Scope: user priorities, default workflow, homepage decision framing, trust model, action hierarchy, and open UX questions.

## Purpose

This document records the UX research and decision framing for the homepage before any new homepage code is written.

The homepage redesign is not only a visual problem. It is primarily a product-experience problem. The current homepage works, but the experience is still shaped by incremental proof-of-concept decisions rather than by a single explicit UX strategy. That creates friction in three ways:
- it makes the app feel less trustworthy than it actually is
- it gives optional complexity more visibility than necessary
- it leaves some important product decisions implicit rather than documented

This document is meant to correct that. It records the intended user priorities, the recommended default path, the major UX decisions that should guide the redesign, and the open questions that should be answered before layout or code changes begin.

This document should be read alongside:
- `docs/Homepage-UI-Research.md`
- `README.md`
- `docs/Architecture.md`

## Core Research Position

The homepage should primarily optimize for a one-off or occasional user who wants to clean exported OneNote pages quickly and safely.

Advanced and repeat-user workflows are important, but they should not dominate the first-run experience.

This is the most important UX conclusion in the research.

Why this is the right default position:
- the current README quick-start flow is already optimized for fast first use
- the app defaults to auto-convert today
- the stable release path is intentionally narrow and strong enough to support a guided first-run experience
- users who need advanced controls can still access them, but they do not need to be burdened by them up front

In other words, the product already behaves like a first-success-oriented tool. The homepage should reflect that clearly and intentionally.

## Primary UX Goal

The homepage should make the first successful conversion feel inevitable.

That means the page should help the user move from uncertainty to confidence with minimal decision load.

The desired sequence is:
- understand what the tool does
- trust that it is safe to use
- know whether the file type is supported
- perform the first action with confidence
- see clear progress and results
- discover advanced options only if needed

## User Types

### Primary user: one-off or occasional user

Typical characteristics:
- exported a OneNote page and wants a cleaner HTML result
- may only use the tool once or a few times
- does not want to study configuration options first
- is sensitive to trust signals and unsupported-file ambiguity
- values speed, clarity, and safety over configurability

What this user needs:
- obvious first action
- support scope stated clearly
- strong privacy reassurance
- no requirement to understand advanced settings
- fast feedback after adding a file

### Secondary user: repeat or advanced user

Typical characteristics:
- may process multiple files often
- may want to review settings before conversion
- may care about ZIP packaging, Markdown, externalized CSS, or exported-page enhancements
- is more willing to tolerate configuration density if the tool remains predictable

What this user needs:
- access to optional settings without friction
- meaningful control labels and helper text
- clear differences between stable and experimental behavior
- strong results visibility for multi-file workflows

### UX priority decision

The homepage should be designed primarily for the first user type and should accommodate the second user type through progressive disclosure.

That means:
- first-run clarity beats immediate configurability
- sensible defaults beat visible optionality
- advanced users should still be respected, but not centered in the first impression

## Recommended Default Workflow

The recommended homepage workflow is:

1. User lands on the homepage.
2. User immediately sees what the tool does, what files it supports, and that files stay local.
3. User adds one or more `.mht` or `.mhtml` files.
4. Conversion starts automatically by default.
5. Results appear with clear per-file status.
6. User downloads the output directly, or downloads a ZIP if appropriate.
7. Advanced options remain available for deliberate use, not mandatory use.

This flow is already close to the current product behavior. The redesign should strengthen it rather than replace it.

## Key UX Decision: Keep Auto-Convert On By Default

Recommendation: yes.

This is one of the few UX decisions that is strong enough to document now.

Reasons:

### 1. It reduces pre-conversion friction

Every extra decision before the first successful result increases hesitation.

If the user has already chosen a supported file and the stable path is known, automatically starting conversion is a better default than waiting for a second confirming action.

### 2. It fits the product's current positioning

The README already frames the tool as something that should work quickly for someone who may only use it once. Auto-convert reinforces that promise.

### 3. It avoids unnecessary action duplication

If the default path is stable and narrow, then forcing a second `Convert` click for all users adds ceremony without adding much value.

### 4. It keeps advanced users supported without centering them

Users who prefer manual review before conversion can still turn auto-convert off in Advanced options.

### Important condition

If auto-convert stays on by default, the homepage must explain that clearly and calmly.

The user should never wonder:
- why conversion started immediately
- why the `Convert` button is disabled
- whether the app is doing something unexpected

Therefore the redesign should ensure:
- the main card tells users that conversion starts automatically by default
- manual convert is presented as an optional mode
- the disabled manual state is either de-emphasized or relocated so it does not feel broken

## Key UX Decision: Prioritize The One-Off User

Recommendation: yes.

The main homepage should be optimized for the user who needs to succeed quickly without learning the whole product.

This does not mean the product should become simplistic. It means the first layer of the homepage should be tightly aligned with the most common and most trust-sensitive scenario.

Reasons:
- first-time users are more sensitive to unclear scope and trust gaps
- successful first use is likely to matter more than exposing every available option immediately
- the product already has the right building blocks for progressive disclosure
- a clean first-run experience will also help repeat users, while the reverse is not always true

What this means in practice:
- the homepage should lead with the stable path
- advanced settings should remain collapsed
- experimental features should be clearly marked
- the page should answer first-run questions quickly

## Trust Model For The Homepage

Trust is not only a visual design issue. It is the cumulative effect of several UX signals.

The homepage should intentionally communicate trust through five dimensions.

### 1. Scope clarity

Users trust tools more when the supported path is explicit.

For this product, that means:
- state that the stable release supports MHTML input
- avoid implying that unsupported native OneNote formats are equally ready
- keep the stable HTML path clearly distinguished from experimental output paths

### 2. Privacy clarity

Users trust local file tools more when privacy is stated plainly and early.

For this product, that means:
- say that files stay on the device
- say that processing happens locally in the browser
- avoid vague privacy language

### 3. Action clarity

Users trust tools more when they can tell what to do first.

For this product, that means:
- the primary action should be obvious
- the page should not show too many same-weight actions near the top
- disabled states must be explained or reduced

### 4. State clarity

Users trust tools more when progress, success, unsupported input, and error states are explicit.

For this product, that means:
- queue and conversion states should be easy to parse
- unsupported files should feel deliberately rejected, not mysteriously broken
- per-file results should remain clear in batch workflows

### 5. Maturity cues

Users trust tools more when the interface feels intentionally designed rather than incrementally assembled.

For this product, that means:
- polished help affordance
- consistent copy style
- calm hierarchy
- contextual rather than premature secondary actions

## Current UX Frictions

The current homepage already works, but several small issues combine into a weaker experience.

### Friction 1: Too much conceptual weight near the top

The homepage exposes import, convert, ZIP download, advanced settings, theme control, help, and the dropzone in a relatively compact area. Nothing is individually unreasonable, but together they create more interpretive work than necessary for a first-time user.

### Friction 2: A visible but disabled major action

Because auto-convert is on by default, the visible `Convert` button is disabled at initial load. This is technically accurate, but it creates a small trust tax because users must understand why an apparently important action is unavailable.

### Friction 3: Trust information is present but not orchestrated

The homepage mentions local processing, supported file types, and offline capability in multiple places, but not in a way that creates a strong, intentional first impression.

### Friction 4: Help content is useful but too dense for first-line onboarding

The help modal includes real information, but it is trying to serve both quick guidance and deeper product nuance. That makes it less effective at either role.

### Friction 5: Stable and optional paths are not clearly tiered enough

The product does distinguish advanced options from the default path, but the overall experience could do more to make the stable first-run route feel unmistakably primary.

## UX Principles For The Redesign

The homepage redesign should follow these principles.

### Principle 1: One clear first action

Users should not have to decide between multiple top-level actions before they have added a file.

### Principle 2: Stable path first

The homepage should lead with the stable MHTML-to-HTML workflow, not with optional export nuance.

### Principle 3: Progressive disclosure

Advanced controls should be available, but never required for first success.

### Principle 4: Calm clarity over feature density

The page should feel dependable and easy to scan, not like a compact control board.

### Principle 5: Trust signals should be visible without being noisy

Privacy, support scope, and product maturity should be obvious, but they should not feel like warnings or disclaimers.

### Principle 6: Contextual actions should appear when they are relevant

ZIP download and some manual workflow controls are important, but they do not need to compete with the initial import action.

## Questions The UX Work Must Answer

This section records the important questions that should guide the redesign discussion.

### Product strategy questions

1. Who is the homepage really for: one-off users, repeat users, or both equally?
2. What single user outcome should the homepage optimize for?
3. Which product qualities most need to be communicated on first impression?
4. What do we want a user to believe about the product within the first 5 to 10 seconds?

### Workflow questions

1. Should auto-convert stay on by default? Current recommendation: yes.
2. Should manual convert remain visible at the top level, or move into a more contextual role?
3. Should ZIP download remain near import actions, or move closer to results?
4. Should the results panel remain hidden until files are added, or should the homepage show a prepared empty-state panel from the start?
5. How should batch workflows differ from one-file workflows visually and textually?

### Trust questions

1. Where should `Files stay on your device` appear for maximum credibility?
2. How do we make supported formats obvious without making the homepage feel narrow or defensive?
3. How do we communicate experimental features without undermining confidence in the stable path?
4. How do we make unsupported-file handling feel intentional and reliable?

### Onboarding questions

1. What should live in the help modal versus inline homepage guidance?
2. What is the shortest copy that still explains the product accurately?
3. Do users need to understand ZIP export before their first successful conversion, or only after results exist?
4. Should the homepage explicitly explain auto-convert, or should that live only in Advanced options?

### Accessibility and clarity questions

1. Is every major control understandable from its label alone?
2. Does the disabled manual-convert state meet the clarity standard we want for a polished product?
3. Are status badges and labels clear enough without relying only on color?
4. Does the theme control look like a polished user feature rather than a developer convenience?

## Preliminary Answers To The Most Important Questions

Some questions are still open, but several answers are already strong enough to record.

### Do we keep auto-convert turned on?

Yes, unless later usability testing proves that it creates more confusion than convenience.

The current evidence supports keeping it on.

### Do we prioritize the one-off user?

Yes.

The homepage should optimize for the user who needs quick first success, while advanced users are supported through progressive disclosure.

### Should advanced options stay collapsed?

Yes.

This is important both for clarity and for trust. A narrow, stable first-run path should not be visually drowned by optional controls.

### Should ZIP download remain a top-of-page peer to import?

Probably not.

It is more coherent as a contextual results-stage action.

### Should support scope be more visible?

Yes.

Supported format and privacy are not minor footnotes. They are central trust signals.

## Recommended UX Model

The homepage should follow a simple three-layer model.

### Layer 1: Immediate understanding

The user sees:
- what the tool does
- what file type it supports
- that processing is local
- where to begin

### Layer 2: Immediate action

The user can:
- browse for files
- drag and drop files
- understand that conversion starts automatically by default

### Layer 3: Optional control and follow-through

The user can:
- open Advanced options if needed
- review conversion status and outputs
- download individual files or all files as a ZIP
- inspect technical details only if useful

This layered model keeps the homepage focused and should scale well from one-file to multi-file use.

## Proposed Success Criteria

The redesign should be considered directionally successful if a first-time user can do all of the following without confusion:

1. Identify the supported input format before selecting a file.
2. Understand that files are processed locally and not uploaded.
3. Recognize the primary action within a few seconds.
4. Understand why conversion begins automatically, if auto-convert remains on.
5. Understand where results will appear.
6. Download output without needing to study advanced options.

Additional criteria for advanced-user support:

1. Advanced options remain easy to find.
2. Experimental features are clearly labeled.
3. ZIP packaging behavior is understandable when relevant.
4. The UI still supports batch conversion and optional manual control without friction.

## Risks To Avoid During Redesign

### Risk 1: Designing for every user equally

Trying to fully optimize the homepage for one-off users, batch users, experimental users, and future native-format users at the same visual level will likely recreate the current coherence problem.

### Risk 2: Replacing clarity with marketing language

The app should feel professional, but not inflated. Clear and accurate product language will build more trust than promotional tone.

### Risk 3: Over-explaining before the first action

Trust requires information, but too much text before interaction can create its own friction.

### Risk 4: Keeping contextual actions too prominent too early

This is especially relevant for manual convert and ZIP download.

### Risk 5: Letting experimental controls visually dilute the stable path

The homepage should communicate that the stable path is strong and primary.

## Recommended Decisions Before Visual Design Starts

The following decisions should be treated as the current working baseline:

1. Primary homepage audience: one-off and occasional users.
2. Default workflow: add files, auto-convert, review results, download output.
3. Default behavior: keep auto-convert on.
4. Progressive disclosure: keep Advanced options collapsed.
5. Action hierarchy: import first, results second, contextual exports after success.
6. Trust hierarchy: support scope and privacy should be visible near the main action.
7. Experimental hierarchy: HTML stable path first, experimental export paths second.

## Suggested Next Artifact

After this UX research, the next useful deliverable would be a dedicated homepage redesign brief or wireframe/spec document that translates these decisions into:
- section order
- component hierarchy
- desktop/mobile layout intent
- exact button hierarchy
- final revised homepage copy

That future document should treat the decisions in this research note as the baseline unless later testing or discussion explicitly overturns them.

<!-- markdownlint-enable MD032 -->