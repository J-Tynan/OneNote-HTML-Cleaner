<!-- markdownlint-disable MD022 MD029 MD032 -->

# Homepage UI Research

Status
- Research document for pre-implementation homepage redesign work.
- Intended audience: product/design planning, UX planning, and implementation handoff.
- Scope: homepage layout, homepage copy, trust signals, action hierarchy, and UI surface inventory.

## Purpose

This document records the current homepage UI, the product messaging that the homepage is implicitly making today, the weaknesses that make the app feel temporary or less trustworthy, and the recommended direction for a more professional and coherent homepage.

The goal is not to finalize code or visual styling in this document. The goal is to establish a durable written baseline so that later design and implementation decisions are made against an explicit product direction rather than against isolated proof-of-concept choices.

This document should be read alongside:
- `docs/Homepage-UX-Research.md`
- `README.md`
- `docs/Architecture.md`

## Product Context

The homepage is the first and most important trust surface in the product.

The current app is already technically more mature than the homepage presentation suggests. The product has a strong core proposition:
- it processes files locally in the browser
- it supports an intentionally narrow stable path
- it avoids mandatory upload workflows
- it offers a simple default flow with optional advanced controls

Those are good product qualities, but the current homepage does not yet package them into a unified and confident interface. Instead, it still reads partly like a developer-facing workbench and partly like a temporary proof-of-concept UI.

That mismatch matters because users do not judge trustworthiness only by technical correctness. They also judge trustworthiness by:
- clarity of the first action
- calm and consistent wording
- visible handling of disabled states
- obvious scope boundaries
- professional treatment of privacy and supported formats
- whether optional complexity is kept out of the way

The homepage redesign should therefore focus on making the existing product qualities visible, legible, and emotionally credible.

## Research Summary

High-level conclusions from reviewing the current homepage markup, UI behavior, and product framing:

1. The product already has a strong default flow for first-time users.
2. The current homepage does not visually or verbally emphasize that default flow strongly enough.
3. Advanced controls are necessary, but they currently contribute too much conceptual weight relative to the main task.
4. Trust signals exist, but they are fragmented across the header, helper text, help modal, and footer rather than being intentionally composed.
5. The current action hierarchy is functional but not ideal: import, convert, and ZIP download currently live too close together before the user has enough context.
6. Several labels are accurate but generic, which makes the product feel less polished than the underlying capability warrants.

## Homepage Jobs

Before discussing visual design, it is useful to define what the homepage must achieve.

The homepage must help a user answer these questions quickly:
- What does this tool do?
- What file types does it support right now?
- Are my files uploaded anywhere?
- What should I do first?
- What happens after I add a file?
- Where do I go if I need more control?

The homepage must also support these product jobs:
- make the default path obvious
- keep the first interaction low-friction
- make the app feel safe and competent
- avoid overwhelming one-off users with optional settings
- keep advanced features available for deliberate use
- show results and recovery states clearly

If the redesign achieves those outcomes, the homepage will feel more professional even before any purely visual polish is added.

## Current Homepage Surface Inventory

This section records the major homepage surfaces and the role each currently plays.

### 1. Header

Current elements:
- product title
- short explanatory sentence
- help button
- theme toggle

Current strengths:
- lightweight and compact
- quick access to help
- theme control is visible and discoverable

Current weaknesses:
- the help trigger uses `?`, which reads as provisional rather than deliberate product design
- the header does not yet work hard enough as a trust surface
- the short explanatory sentence is useful but not structured to maximize confidence
- the header does not clearly separate product identity from utility controls

Current product message implied by the header:
- this is a small browser tool with local processing

Recommended product message for the redesigned header:
- this is a dependable utility for cleaning exported OneNote pages
- it works locally in the browser
- it is intentionally scoped and safe to try

Recommended structural role of the header:
- brand and orientation, not workflow explanation
- help and theme controls should remain here
- privacy/support signals can appear as a concise trust strip or short supporting line

### 2. Primary Import / Start Surface

Current elements:
- card title: `Import files`
- short instruction text
- supported file types note
- auto-convert notice
- `Convert` button
- `Download ZIP` button

Current strengths:
- the user can find the important controls
- the stable supported format is already disclosed
- the auto-convert behavior is explained

Current weaknesses:
- `Import files` describes a mechanism, not an outcome
- `Convert` and `Download ZIP` are visible before they are meaningful
- the section mixes setup, state explanation, manual action, and post-conversion action in one space
- the disabled `Convert` button can feel confusing or broken before the user understands why it is disabled

The current card is serviceable, but it does not yet establish a clean action hierarchy.

Recommended role of this surface in the redesign:
- this should be the main "start here" card
- it should lead with the outcome, not the mechanism
- it should include the most important trust signals near the main action
- it should keep secondary actions contextual rather than equally prominent

Recommended direction:
- primary headline should describe the result the user wants
- supported format and privacy note should sit directly beneath the headline
- the first obvious action should be file selection or drag-and-drop
- `Convert` should not compete with the first-run import action when auto-convert is enabled
- `Download ZIP` should likely move closer to the results context

### 3. Advanced Options Surface

Current elements:
- collapsed `Advanced options` card
- subtext explaining it fine-tunes cleaning/export behavior
- multiple toggles and selects for conversion behavior and output features

Current strengths:
- collapsed by default
- supports the project requirement to keep the main path simple
- communicates that the product has room for power-user or experimental workflows

Current weaknesses:
- the surface mixes stable options, optional enhancements, and experimental features in a way that can feel more like a configuration panel than a carefully tiered experience
- some wording is implementation-accurate but not especially user-centered
- options are individually understandable, but the section as a whole lacks a stronger conceptual grouping

The current control set is not the problem by itself. The main issue is presentation hierarchy.

Recommended structural grouping inside Advanced options:
- Conversion behavior
- Output format
- Export packaging
- Exported page enhancements
- Experimental features

That grouping would make the section feel intentional and easier to scan, even if the underlying controls remain similar.

### 4. Dropzone Surface

Current elements:
- drag-and-drop region
- browse button
- local processing note

Current strengths:
- familiar interaction model
- clear primary browse action
- privacy reassurance is already present

Current weaknesses:
- the copy is practical but still feels generic
- the card does not yet carry enough visual or verbal confidence to act as the emotional center of the homepage
- the text could do more to connect the import action to the promised outcome

Recommended role of this surface:
- the dropzone should be the practical start surface for action
- it should visually feel central, calm, and trustworthy
- it should reinforce support scope and privacy without sounding defensive

### 5. Status and Results Surface

Current elements:
- hidden until queue is non-empty
- section heading
- app state badge
- summary text
- per-file list
- diagnostics details panel

Current strengths:
- the app has a clear results region
- per-file status is visible and explicit
- per-file download affordances are pragmatic
- diagnostics are available without dominating the main view

Current weaknesses:
- `Status and results` is descriptive but not especially strong product language
- the empty-state wording is accurate but flat
- diagnostics may feel more developer-facing than user-facing if not clearly framed
- the current structure is more operational than reassuring

Recommended direction:
- rename the surface to something outcome-focused, such as `Conversion results`
- keep per-file status labels short and calm
- frame diagnostics as optional technical detail rather than as a default part of the homepage mental model

### 6. Help Modal

Current elements:
- usage instructions
- ZIP/CSS guidance
- handwriting caveat
- Markdown note
- converted-page theme note
- toolbar note
- GitHub link

Current strengths:
- contains valuable information
- does real product education, not filler
- helps document behavior without requiring external docs

Current weaknesses:
- too much information for a first-line help surface
- reads more like an internal release summary than a concise user-facing guide
- the important points are not prioritized by user need

Recommended role of help in the redesign:
- concise first-line guidance, not full feature exposition
- emphasize what the tool does, what files it supports, privacy, and where to go for more detail
- longer technical nuance should move to linked documentation if needed

### 7. Footer

Current elements:
- short offline/local processing statement
- documentation link

Current strengths:
- simple and unobtrusive
- reinforces local/offline behavior

Current weaknesses:
- underused as a product trust and orientation surface
- GitHub and other useful references are not exposed here even though they belong naturally in the footer

Recommended role of the footer:
- quiet but trustworthy supporting surface
- reinforce local processing, documentation, and project provenance

## Copy Research: Current Messaging vs Recommended Direction

This section records the current wording patterns and proposes a more consistent copy direction.

### Tone issues in the current homepage

The current homepage copy is not wrong. The issue is that it was written incrementally as features were added. As a result:
- some lines are user-facing and confident
- some lines are explanatory but generic
- some lines sound like implementation notes
- some lines are stronger than the surrounding hierarchy allows

The redesign should move toward a calmer, more deliberate utility-product tone.

Desired tone qualities:
- plain-spoken
- competent
- conservative in claims
- calm rather than promotional
- helpful without overexplaining
- explicit about scope

Tone qualities to avoid:
- jargon-heavy implementation language on the homepage
- overly casual placeholder-feeling wording
- copy that sounds defensive or apologetic
- copy that treats experimental and stable features as equally mature

### Naming the primary action

Current primary section label:
- `Import files`

Observation:
- this is accurate, but it emphasizes the tool mechanism rather than the user outcome

Recommended alternatives:
- `Convert exported OneNote pages`
- `Clean exported OneNote pages`
- `Add exported OneNote files`

Preferred direction:
- lead with the result, then support it with a simpler action label

For example:
- heading: `Convert exported OneNote pages`
- supporting sentence: `Add one or more MHTML files to clean and export them locally in your browser.`

### Supported format disclosure

Current wording:
- `Supported in this release: MHTML (.mht, .mhtml)`

Assessment:
- good and appropriately narrow
- worth keeping in some form

Recommended refinement:
- keep it close to the main action
- ensure it reads like product guidance rather than a minor footnote

Suggested wording:
- `Supported input: .mht and .mhtml`
- `Stable input for this release: MHTML (.mht, .mhtml)`

### Privacy and local-processing copy

Current wording appears in multiple places:
- local, offline processing in header/subtext
- local browser processing note in dropzone
- footer note that files stay on device

Assessment:
- the information is present, which is good
- however, it is spread across multiple surfaces and therefore loses some force

Recommended direction:
- repeat the privacy claim intentionally in two places, not incidentally in many places

Best homepage placements:
- directly near the main import action
- quietly reinforced in the footer

Suggested wording:
- `Files stay on your device.`
- `Processed locally in your browser.`
- `Nothing is uploaded.`

### Manual convert copy

Current state:
- the app defaults to auto-convert
- the manual `Convert` button is disabled when auto-convert is enabled
- a tooltip explains why

Assessment:
- technically clear once understood
- initially feels slightly awkward because a major action is visible but unavailable

Recommended direction:
- if auto-convert remains the default, manual convert should read as an alternate mode rather than as a permanently adjacent primary action

Suggested wording when exposed:
- button: `Convert queued files`
- helper text: `Available when auto-convert is turned off.`

### ZIP export copy

Current state:
- `Download ZIP` is visible in the initial action card
- the behavior is valuable mainly after successful conversion, especially for multi-file output and externalized CSS workflows

Assessment:
- the label is accurate
- the placement is premature

Recommended direction:
- keep ZIP export, but make it contextual

Suggested wording:
- `Download all as ZIP`
- helper text: `Recommended for multiple files or exports with separate CSS assets.`

### Advanced options copy

Current section label:
- `Advanced options`

Assessment:
- good and appropriate
- keep this label

Recommended supporting text:
- `Optional settings for output format, packaging, and exported page features.`

Specific control wording improvements:

Current:
- `Automatically convert files when added to the queue`

Refined:
- `Automatically convert files when added`
- subtext: `Recommended for most users.`

Current:
- `Externalize CSS in separate file`

Refined:
- `Write CSS to separate files`
- subtext: `Best when exporting HTML files together in a ZIP package.`

Current:
- `Enable experimental export formats`

Refined:
- `Enable experimental export formats`
- subtext: `HTML remains the stable default. Markdown is experimental.`

Current:
- `Add theme toggle (Light/Dark) to converted pages`

Refined:
- `Add theme toggle to exported HTML pages`
- subtext: `Adds a light/dark switch to converted HTML output only.`

Current:
- `Add toolbar to exported pages`

Refined:
- `Add toolbar to exported HTML pages`
- subtext: `Adds optional edit and metadata controls to converted output.`

### Help trigger copy

Current help trigger:
- visual `?`

Assessment:
- discoverable enough
- feels temporary and slightly underdesigned

Recommended direction:
- use a help icon or a clearly labeled `Help` control

This small change matters because tiny details strongly affect perceived maturity.

## Recommended Information Hierarchy

Before writing visual code, the homepage should be reorganized around a clearer content hierarchy.

Recommended hierarchy:

1. Product identity
- product name
- concise outcome statement
- light trust reinforcement

2. Primary task surface
- what to do first
- supported input
- privacy message
- browse and dropzone interaction

3. Optional controls
- advanced settings kept collapsed

4. Results and export
- per-file progress and completion
- contextual download actions

5. Support and provenance
- documentation
- GitHub
- local processing reminder

This order respects the mental sequence of a first-time user.

## Visual Trust Signals To Support Later Design Work

Although this document is not a visual spec, the research should record which ideas most strongly influence trust.

The homepage should visually communicate:
- one obvious first action
- clean spacing and grouping
- restrained use of emphasis
- clear state handling for disabled and loading controls
- visible but calm support notes
- obvious separation between stable defaults and optional complexity

Visual traits likely to help:
- stronger section hierarchy
- fewer equally weighted call-to-action buttons near the top
- better elevation/contrast discipline for the main start card
- more polished small controls in the header
- trust notes styled as product information, not as disclaimers

## UI Problems Contributing To Weak Trust Today

This section records the issues most likely to make the current homepage feel less professional.

### Problem 1: The page leads with controls more than it leads with confidence

The homepage exposes many useful controls, but it does not frame them within a strong product message. Users therefore encounter functions before they encounter reassurance.

### Problem 2: Primary and contextual actions are too close together

`Browse files`, `Convert`, and `Download ZIP` belong to different stages of the workflow, but the current layout places them too near each other in the upper experience.

### Problem 3: The help affordance feels temporary

The `?` button works, but it subtly signals placeholder UI rather than finished product design.

### Problem 4: Optional complexity is present before enough trust is established

Advanced options are collapsed, which is correct, but the homepage overall still reads like a flexible tool before it reads like a focused solution.

### Problem 5: Trust messaging is fragmented

Privacy, offline capability, supported formats, and stable path messaging all exist, but they are not deliberately orchestrated.

## Proposed UI Direction

The redesigned homepage should feel like a focused utility application with a clear start surface.

Proposed design intent:
- professional but not corporate-heavy
- calm and readable
- trustworthy through scope clarity
- optimized for the first successful conversion
- supportive of advanced workflows without foregrounding them

Working UI principles:
- outcome first, settings second
- trust first, nuance second
- stable path first, experimental path second
- active states visible, inactive states explained
- support information concise and well placed

## Recommended Homepage Content Outline

This is not yet a layout wireframe. It is a content structure recommendation.

### Header
- Product name
- One-sentence promise
- Help
- Theme toggle

### Main start card
- Outcome-oriented heading
- Short supporting sentence
- Supported input note
- Local processing note
- Browse button
- Dropzone area

### Optional settings card
- Advanced options collapsed by default
- grouped controls with clearer categories

### Results card
- conversion status
- per-file outputs
- contextual download actions
- optional technical details

### Footer
- local-processing reminder
- documentation link
- GitHub link
- release notes or project information link if useful

## Decisions This Research Supports

This document supports the following preliminary decisions before implementation:

1. The homepage should prioritize the one-off user and first successful conversion.
2. Auto-convert should remain the default behavior unless later research strongly disproves it.
3. Advanced options should remain collapsed by default.
4. ZIP export should be treated as a contextual post-conversion action.
5. The header should use a more polished help affordance than a raw `?` trigger.
6. Trust messaging should be intentionally repeated near the main action and in the footer.

## Open UI Questions

Questions that should be resolved before moving into implementation:

1. Should the homepage use a hero-like top section, or should it stay closer to a compact workbench layout?
2. Should the supported file-type note live in the main card body, as a trust strip, or both?
3. Should the manual `Convert` control be hidden entirely while auto-convert is on, or merely de-emphasized?
4. Should the help system remain a modal, or should the homepage move some guidance inline and reserve the modal for deeper help?
5. How much explanatory copy can the homepage carry before it starts to feel heavy rather than reassuring?

## Answers to Open UI Questions.
1. The homepage should stay closer to a compact workbench layout.
2. Main card body.
3. De-emphasized.
4. Move some guidance inline and reserve the modal for deeper help.
5. Try to keep the explanatory copy lightweight, with no emojis.

## Recommended Next Document

After this UI research, the next most useful artifact is a homepage layout/wireframe specification that defines:
- section order
- card hierarchy
- button hierarchy
- mobile and desktop behavior
- revised final copy

That next document should build on the conclusions in this research note rather than restart the discussion.

<!-- markdownlint-enable MD022 MD029 MD032 -->