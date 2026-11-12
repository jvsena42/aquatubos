# Aquatubos brand guidelines

Aquatubos teaches civil engineering students to design water distribution networks. The identity
is calm and technical: geometric shapes, one blue, one cyan, no mascots and no game-style
decoration.

## Logo

The mark is a water drop drawn as a pipe: three nodes (top, left, right) joined by pipes of
constant width, closing a loop like a ring main. The lower half of the drop is filled with water,
and the horizontal pipe doubles as the water level.

It is drawn on a 64 x 64 grid. Pipes are 5 units wide, nodes are circles of radius 5.5 and the
drop body is a circle of radius 18 centred at (32, 39), closed by two tangents that meet at
(32, 9).

### Files

All sources are in `src/assets/brand/`.

| File                    | Use                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `logo-full.svg`         | Mark and wordmark on light backgrounds. Default choice for headers, documents and the README. |
| `logo-full-dark.svg`    | Mark and wordmark on dark backgrounds (dark theme header).                                    |
| `logo-mark.svg`         | Mark alone on light backgrounds, 33 px and larger.                                            |
| `logo-mark-dark.svg`    | Mark alone on dark backgrounds, 33 px and larger.                                             |
| `logo-mark-small.svg`   | Simplified mark for 32 px and smaller: a thicker drop outline, half full, without nodes.      |
| `logo-mark-mono.svg`    | Single colour, uses `currentColor`. For print, watermarks and places with one ink.            |
| `logo-mark-inverse.svg` | White mark for the solid brand-blue background. Source of the app icons.                      |
| `favicon.svg`           | The small mark with a `prefers-color-scheme` rule. Copied to `public/favicon.svg`.            |
| `og-image.svg`          | Source of the 1200 x 630 social image.                                                        |

The wordmark is the word "Aquatubos" set in Inter at weight 650 with -0.015 em tracking and
converted to paths, so the SVGs render the same without any font installed. To change the
wordmark, set the text again in Inter and convert it to paths; do not replace it with a `<text>`
element. The same applies to the text in `og-image.svg` (name at weight 650, description at
weight 450).

### Clear space and minimum size

- Clear space: keep an empty margin equal to the diameter of one node (11 units, about 1/6 of the
  mark height) on every side of the mark or of the full logo.
- Full logo: minimum height 40 px on screen. Below that, use the mark alone.
- `logo-mark.svg`: minimum 33 px. At 32 px and below use `logo-mark-small.svg`, which stays
  legible at 16 px.

### Misuse

- Do not recolour the mark outside the variants above, and do not add gradients, shadows or
  outlines.
- Do not stretch, rotate or crop it, and do not change the spacing between mark and wordmark.
- Do not place the light variant on a dark background or the dark variant on a light one. On
  photos or coloured backgrounds use the mono variant in white or in `--color-text`.
- Do not set the wordmark in another typeface or weight.
- Do not use the full mark at 32 px or below; the nodes blur into the outline.

## Colour

Components read colours from the CSS variables in `src/styles/tokens.css` and never hard-code
them. Light is the default theme. Dark applies with the system setting or with
`data-theme="dark"` on `<html>`; `data-theme="light"` forces light. The two dark blocks in the
file must hold the same values.

### Brand and neutrals

| Token                      | Light                | Dark             | Role                                                    |
| -------------------------- | -------------------- | ---------------- | ------------------------------------------------------- |
| `--color-primary`          | #0b4f8a              | #5aa9e6          | Primary actions, links, selected state                  |
| `--color-primary-hover`    | #093f6e              | #7dbdee          | Hover and pressed state of primary                      |
| `--color-primary-contrast` | #ffffff              | #06213a          | Text and icons on primary                               |
| `--color-accent`           | #0e7490              | #4fd1d9          | Secondary emphasis, highlights (text-safe)              |
| `--color-brand`            | #0b4f8a              | #6cb4ee          | Logo pipes. Decorative                                  |
| `--color-brand-accent`     | #14a3b8              | #4fd1d9          | Logo nodes. Decorative, not text-safe in light          |
| `--color-brand-water`      | #a5dfeb              | #1c5f7a          | Logo water fill. Decorative                             |
| `--color-bg`               | #f4f7fa              | #0b1420          | Page background                                         |
| `--color-surface`          | #ffffff              | #121e2d          | Cards, panels, dialogs                                  |
| `--color-surface-2`        | #eaf0f5              | #1a2a3d          | Table headers, inset areas, hover rows                  |
| `--color-border`           | #cbd5e1              | #2f4257          | Dividers and card borders (decorative)                  |
| `--color-border-strong`    | #7b8a9a              | #62788f          | Input and control outlines (3:1 against bg and surface) |
| `--color-text`             | #0f1b2a              | #e6edf5          | Body text                                               |
| `--color-text-muted`       | #4a5b6e              | #9fb0c3          | Secondary text, captions, units                         |
| `--color-focus`            | #0e7490              | #4fd1d9          | Focus ring                                              |
| `--color-overlay`          | rgb(15 27 42 / 0.45) | rgb(0 0 0 / 0.6) | Scrim behind dialogs                                    |

The app icons and the browser theme colour use #0b4f8a (light) and #0b1420 (dark). The PWA splash
background is #f4f7fa.

### Status

| Token               | Light   | Dark    | Role                           |
| ------------------- | ------- | ------- | ------------------------------ |
| `--color-ok`        | #007566 | #7ce8c0 | Requirement met                |
| `--color-ok-bg`     | #dff3ee | #0f3329 | Background of ok messages      |
| `--color-warn`      | #9c5c00 | #f5cf45 | Close to a limit, needs review |
| `--color-warn-bg`   | #fdf0d5 | #3a2e0c | Background of warnings         |
| `--color-danger`    | #96111a | #f47565 | Requirement violated, errors   |
| `--color-danger-bg` | #fbe4e2 | #3d1715 | Background of errors           |
| `--color-info`      | #0b4f8a | #7dbdee | Neutral information            |
| `--color-info-bg`   | #e1eefa | #102a44 | Background of information      |

Status colours are never the only signal: always pair them with an icon or a text label. They
differ in lightness as well as hue (ok is a blue-leaning green, danger is a dark red in light
theme and the darkest status colour in dark theme, warn is the lightest of the three warm/green
colours) so they remain apart for red-green colour-blind users. Colour difference (CIE76 delta E)
after simulating each deficiency with the Machado, Oliveira and Fernandes (2009) matrices at full
severity:

| Pair          | Theme | Normal | Protanopia | Deuteranopia | Tritanopia |
| ------------- | ----- | ------ | ---------- | ------------ | ---------- |
| ok / warn     | Light | 75     | 44         | 56           | 72         |
| ok / danger   | Light | 90     | 28         | 40           | 98         |
| ok / info     | Light | 54     | 42         | 41           | 15         |
| warn / danger | Light | 40     | 33         | 20           | 30         |
| warn / info   | Light | 94     | 85         | 96           | 67         |
| danger / info | Light | 86     | 58         | 79           | 93         |
| ok / warn     | Dark  | 72     | 59         | 62           | 66         |
| ok / danger   | Dark  | 93     | 31         | 34           | 110        |
| ok / info     | Dark  | 53     | 45         | 41           | 15         |
| warn / danger | Dark  | 64     | 57         | 36           | 46         |
| warn / info   | Dark  | 101    | 103        | 102          | 62         |
| danger / info | Dark  | 84     | 54         | 70           | 102        |

The weakest pairs are ok / info with tritanopia (15) and warn / danger with deuteranopia in the
light theme (20). The icon or label carries the meaning there.

### Hydraulics

Colours for the network drawing, profiles and result maps. They are graphics, so the target is
3:1 against the background, and every one of them also has a legend entry or a label.

| Token                   | Light   | Dark    | Role                                    |
| ----------------------- | ------- | ------- | --------------------------------------- |
| `--color-pressure-low`  | #96111a | #f47565 | Pressure below the minimum              |
| `--color-pressure-ok`   | #007566 | #7ce8c0 | Pressure within limits                  |
| `--color-pressure-high` | #7b3fb0 | #c9a0f0 | Pressure above the maximum              |
| `--color-velocity-low`  | #7a8794 | #7f8ea0 | Velocity below the recommended range    |
| `--color-velocity-ok`   | #075a73 | #5fdde4 | Velocity within the range               |
| `--color-velocity-high` | #c2410c | #ff9d5c | Velocity above the maximum              |
| `--color-pipe`          | #33475b | #b4c2d1 | Pipes and nodes without a result colour |
| `--color-water`         | #1a86ba | #5cc0ea | Water lines, flow arrows                |
| `--color-water-fill`    | #d3ecf7 | #143a52 | Water area fill (tanks, reservoirs)     |
| `--color-hgl`           | #0b6fc2 | #6db8f5 | Hydraulic grade line                    |
| `--color-terrain`       | #7a5c3a | #c4a57c | Ground line                             |
| `--color-terrain-fill`  | #e6d9c6 | #3a2f22 | Ground fill below the line              |
| `--color-reservoir`     | #0b4f8a | #5aa9e6 | Reservoir and tank symbols              |

Simulated colour difference between the three states of each scale, lowest of protanopia and
deuteranopia: pressure low / ok 28 (light) and 31 (dark); velocity low / ok 21 (light) and 22
(dark). All other pairs are above 40.

### Contrast

WCAG 2.x contrast ratios computed from the values in `tokens.css` (relative luminance formula,
sRGB). Text needs 4.5:1 (AA); graphics and control outlines need 3:1. Every row passes.

Light theme:

| Foreground                         | Background                      | Ratio | Minimum | Result |
| ---------------------------------- | ------------------------------- | ----- | ------- | ------ |
| `--color-text` #0f1b2a             | `--color-surface` #ffffff       | 17.35 | 4.5     | pass   |
| `--color-text` #0f1b2a             | `--color-bg` #f4f7fa            | 16.13 | 4.5     | pass   |
| `--color-text-muted` #4a5b6e       | `--color-surface` #ffffff       | 6.97  | 4.5     | pass   |
| `--color-text-muted` #4a5b6e       | `--color-bg` #f4f7fa            | 6.48  | 4.5     | pass   |
| `--color-primary` #0b4f8a          | `--color-surface` #ffffff       | 8.40  | 4.5     | pass   |
| `--color-primary` #0b4f8a          | `--color-bg` #f4f7fa            | 7.81  | 4.5     | pass   |
| `--color-accent` #0e7490           | `--color-surface` #ffffff       | 5.36  | 4.5     | pass   |
| `--color-accent` #0e7490           | `--color-bg` #f4f7fa            | 4.98  | 4.5     | pass   |
| `--color-ok` #007566               | `--color-surface` #ffffff       | 5.62  | 4.5     | pass   |
| `--color-ok` #007566               | `--color-bg` #f4f7fa            | 5.23  | 4.5     | pass   |
| `--color-warn` #9c5c00             | `--color-surface` #ffffff       | 5.32  | 4.5     | pass   |
| `--color-warn` #9c5c00             | `--color-bg` #f4f7fa            | 4.95  | 4.5     | pass   |
| `--color-danger` #96111a           | `--color-surface` #ffffff       | 8.78  | 4.5     | pass   |
| `--color-danger` #96111a           | `--color-bg` #f4f7fa            | 8.17  | 4.5     | pass   |
| `--color-info` #0b4f8a             | `--color-surface` #ffffff       | 8.40  | 4.5     | pass   |
| `--color-info` #0b4f8a             | `--color-bg` #f4f7fa            | 7.81  | 4.5     | pass   |
| `--color-primary-contrast` #ffffff | `--color-primary` #0b4f8a       | 8.40  | 4.5     | pass   |
| `--color-primary-contrast` #ffffff | `--color-primary-hover` #093f6e | 10.78 | 4.5     | pass   |
| `--color-ok` #007566               | `--color-ok-bg` #dff3ee         | 4.87  | 4.5     | pass   |
| `--color-warn` #9c5c00             | `--color-warn-bg` #fdf0d5       | 4.72  | 4.5     | pass   |
| `--color-danger` #96111a           | `--color-danger-bg` #fbe4e2     | 7.23  | 4.5     | pass   |
| `--color-info` #0b4f8a             | `--color-info-bg` #e1eefa       | 7.13  | 4.5     | pass   |
| `--color-text` #0f1b2a             | `--color-surface-2` #eaf0f5     | 15.10 | 4.5     | pass   |
| `--color-text-muted` #4a5b6e       | `--color-surface-2` #eaf0f5     | 6.07  | 4.5     | pass   |
| `--color-text` #0f1b2a             | `--color-terrain-fill` #e6d9c6  | 12.48 | 4.5     | pass   |
| `--color-border-strong` #7b8a9a    | `--color-surface` #ffffff       | 3.53  | 3       | pass   |
| `--color-border-strong` #7b8a9a    | `--color-bg` #f4f7fa            | 3.29  | 3       | pass   |
| `--color-focus` #0e7490            | `--color-surface` #ffffff       | 5.36  | 3       | pass   |
| `--color-focus` #0e7490            | `--color-bg` #f4f7fa            | 4.98  | 3       | pass   |
| `--color-pressure-low` #96111a     | `--color-surface` #ffffff       | 8.78  | 3       | pass   |
| `--color-pressure-low` #96111a     | `--color-bg` #f4f7fa            | 8.17  | 3       | pass   |
| `--color-pressure-ok` #007566      | `--color-surface` #ffffff       | 5.62  | 3       | pass   |
| `--color-pressure-ok` #007566      | `--color-bg` #f4f7fa            | 5.23  | 3       | pass   |
| `--color-pressure-high` #7b3fb0    | `--color-surface` #ffffff       | 6.60  | 3       | pass   |
| `--color-pressure-high` #7b3fb0    | `--color-bg` #f4f7fa            | 6.14  | 3       | pass   |
| `--color-velocity-low` #7a8794     | `--color-surface` #ffffff       | 3.67  | 3       | pass   |
| `--color-velocity-low` #7a8794     | `--color-bg` #f4f7fa            | 3.41  | 3       | pass   |
| `--color-velocity-ok` #075a73      | `--color-surface` #ffffff       | 7.72  | 3       | pass   |
| `--color-velocity-ok` #075a73      | `--color-bg` #f4f7fa            | 7.18  | 3       | pass   |
| `--color-velocity-high` #c2410c    | `--color-surface` #ffffff       | 5.18  | 3       | pass   |
| `--color-velocity-high` #c2410c    | `--color-bg` #f4f7fa            | 4.82  | 3       | pass   |
| `--color-pipe` #33475b             | `--color-surface` #ffffff       | 9.58  | 3       | pass   |
| `--color-pipe` #33475b             | `--color-bg` #f4f7fa            | 8.91  | 3       | pass   |
| `--color-water` #1a86ba            | `--color-surface` #ffffff       | 4.07  | 3       | pass   |
| `--color-water` #1a86ba            | `--color-bg` #f4f7fa            | 3.78  | 3       | pass   |
| `--color-hgl` #0b6fc2              | `--color-surface` #ffffff       | 5.16  | 3       | pass   |
| `--color-hgl` #0b6fc2              | `--color-bg` #f4f7fa            | 4.80  | 3       | pass   |
| `--color-terrain` #7a5c3a          | `--color-surface` #ffffff       | 6.14  | 3       | pass   |
| `--color-terrain` #7a5c3a          | `--color-bg` #f4f7fa            | 5.71  | 3       | pass   |
| `--color-reservoir` #0b4f8a        | `--color-surface` #ffffff       | 8.40  | 3       | pass   |
| `--color-reservoir` #0b4f8a        | `--color-bg` #f4f7fa            | 7.81  | 3       | pass   |

Dark theme:

| Foreground                         | Background                      | Ratio | Minimum | Result |
| ---------------------------------- | ------------------------------- | ----- | ------- | ------ |
| `--color-text` #e6edf5             | `--color-surface` #121e2d       | 14.25 | 4.5     | pass   |
| `--color-text` #e6edf5             | `--color-bg` #0b1420            | 15.68 | 4.5     | pass   |
| `--color-text-muted` #9fb0c3       | `--color-surface` #121e2d       | 7.58  | 4.5     | pass   |
| `--color-text-muted` #9fb0c3       | `--color-bg` #0b1420            | 8.34  | 4.5     | pass   |
| `--color-primary` #5aa9e6          | `--color-surface` #121e2d       | 6.61  | 4.5     | pass   |
| `--color-primary` #5aa9e6          | `--color-bg` #0b1420            | 7.27  | 4.5     | pass   |
| `--color-accent` #4fd1d9           | `--color-surface` #121e2d       | 9.17  | 4.5     | pass   |
| `--color-accent` #4fd1d9           | `--color-bg` #0b1420            | 10.09 | 4.5     | pass   |
| `--color-ok` #7ce8c0               | `--color-surface` #121e2d       | 11.33 | 4.5     | pass   |
| `--color-ok` #7ce8c0               | `--color-bg` #0b1420            | 12.47 | 4.5     | pass   |
| `--color-warn` #f5cf45             | `--color-surface` #121e2d       | 11.12 | 4.5     | pass   |
| `--color-warn` #f5cf45             | `--color-bg` #0b1420            | 12.24 | 4.5     | pass   |
| `--color-danger` #f47565           | `--color-surface` #121e2d       | 6.07  | 4.5     | pass   |
| `--color-danger` #f47565           | `--color-bg` #0b1420            | 6.68  | 4.5     | pass   |
| `--color-info` #7dbdee             | `--color-surface` #121e2d       | 8.31  | 4.5     | pass   |
| `--color-info` #7dbdee             | `--color-bg` #0b1420            | 9.15  | 4.5     | pass   |
| `--color-primary-contrast` #06213a | `--color-primary` #5aa9e6       | 6.42  | 4.5     | pass   |
| `--color-primary-contrast` #06213a | `--color-primary-hover` #7dbdee | 8.07  | 4.5     | pass   |
| `--color-ok` #7ce8c0               | `--color-ok-bg` #0f3329         | 9.28  | 4.5     | pass   |
| `--color-warn` #f5cf45             | `--color-warn-bg` #3a2e0c       | 8.82  | 4.5     | pass   |
| `--color-danger` #f47565           | `--color-danger-bg` #3d1715     | 5.69  | 4.5     | pass   |
| `--color-info` #7dbdee             | `--color-info-bg` #102a44       | 7.23  | 4.5     | pass   |
| `--color-text` #e6edf5             | `--color-surface-2` #1a2a3d     | 12.34 | 4.5     | pass   |
| `--color-text-muted` #9fb0c3       | `--color-surface-2` #1a2a3d     | 6.57  | 4.5     | pass   |
| `--color-text` #e6edf5             | `--color-terrain-fill` #3a2f22  | 11.06 | 4.5     | pass   |
| `--color-border-strong` #62788f    | `--color-surface` #121e2d       | 3.68  | 3       | pass   |
| `--color-border-strong` #62788f    | `--color-bg` #0b1420            | 4.05  | 3       | pass   |
| `--color-focus` #4fd1d9            | `--color-surface` #121e2d       | 9.17  | 3       | pass   |
| `--color-focus` #4fd1d9            | `--color-bg` #0b1420            | 10.09 | 3       | pass   |
| `--color-pressure-low` #f47565     | `--color-surface` #121e2d       | 6.07  | 3       | pass   |
| `--color-pressure-low` #f47565     | `--color-bg` #0b1420            | 6.68  | 3       | pass   |
| `--color-pressure-ok` #7ce8c0      | `--color-surface` #121e2d       | 11.33 | 3       | pass   |
| `--color-pressure-ok` #7ce8c0      | `--color-bg` #0b1420            | 12.47 | 3       | pass   |
| `--color-pressure-high` #c9a0f0    | `--color-surface` #121e2d       | 7.82  | 3       | pass   |
| `--color-pressure-high` #c9a0f0    | `--color-bg` #0b1420            | 8.61  | 3       | pass   |
| `--color-velocity-low` #7f8ea0     | `--color-surface` #121e2d       | 5.03  | 3       | pass   |
| `--color-velocity-low` #7f8ea0     | `--color-bg` #0b1420            | 5.53  | 3       | pass   |
| `--color-velocity-ok` #5fdde4      | `--color-surface` #121e2d       | 10.37 | 3       | pass   |
| `--color-velocity-ok` #5fdde4      | `--color-bg` #0b1420            | 11.41 | 3       | pass   |
| `--color-velocity-high` #ff9d5c    | `--color-surface` #121e2d       | 8.19  | 3       | pass   |
| `--color-velocity-high` #ff9d5c    | `--color-bg` #0b1420            | 9.01  | 3       | pass   |
| `--color-pipe` #b4c2d1             | `--color-surface` #121e2d       | 9.27  | 3       | pass   |
| `--color-pipe` #b4c2d1             | `--color-bg` #0b1420            | 10.20 | 3       | pass   |
| `--color-water` #5cc0ea            | `--color-surface` #121e2d       | 8.15  | 3       | pass   |
| `--color-water` #5cc0ea            | `--color-bg` #0b1420            | 8.97  | 3       | pass   |
| `--color-hgl` #6db8f5              | `--color-surface` #121e2d       | 7.86  | 3       | pass   |
| `--color-hgl` #6db8f5              | `--color-bg` #0b1420            | 8.66  | 3       | pass   |
| `--color-terrain` #c4a57c          | `--color-surface` #121e2d       | 7.22  | 3       | pass   |
| `--color-terrain` #c4a57c          | `--color-bg` #0b1420            | 7.95  | 3       | pass   |
| `--color-reservoir` #5aa9e6        | `--color-surface` #121e2d       | 6.61  | 3       | pass   |
| `--color-reservoir` #5aa9e6        | `--color-bg` #0b1420            | 7.27  | 3       | pass   |

`--color-brand-accent` (#14a3b8, 3.02:1 on white and 2.81:1 on `--color-bg`) and `--color-border`
are decorative and are not in the table. Do not use them for text or as the only boundary of a
control.

When a colour changes, recompute the ratios and update this table.

## Typography

| Token         | Family                      | Use                                                  |
| ------------- | --------------------------- | ---------------------------------------------------- |
| `--font-sans` | `'Inter Variable'`          | Interface text, headings, labels                     |
| `--font-mono` | `'JetBrains Mono Variable'` | Calculation panels, result tables, node and pipe ids |

The family names are the ones exported by `@fontsource-variable/inter` and
`@fontsource-variable/jetbrains-mono`; both variables fall back to the static family name and
then to system fonts. The fonts are self-hosted, so the app works offline.

Numbers that are compared in columns (pressures, flows, diameters, costs) use tabular digits: add
the `tabular-nums` class, or set `font-feature-settings: var(--font-feature-tabular)`. JetBrains
Mono is already fixed-width; Inter needs the feature.

| Token             | Value    | px at default root | Use                           |
| ----------------- | -------- | ------------------ | ----------------------------- |
| `--font-size-xs`  | 0.75rem  | 12                 | Captions, units, table notes  |
| `--font-size-sm`  | 0.875rem | 14                 | Dense UI, tables, form labels |
| `--font-size-md`  | 1rem     | 16                 | Body text                     |
| `--font-size-lg`  | 1.25rem  | 20                 | Section headings              |
| `--font-size-xl`  | 1.625rem | 26                 | Page headings                 |
| `--font-size-2xl` | 2.125rem | 34                 | Landing title                 |

Weights: `--font-weight-regular` 400, `--font-weight-medium` 500, `--font-weight-semibold` 600,
`--font-weight-bold` 700. Line height: `--line-height` 1.5 for text, `--line-height-tight` 1.2
for headings.

## Spacing, radius and shadow

Spacing follows a 4 px base.

| Token       | Value   | px  |
| ----------- | ------- | --- |
| `--space-1` | 0.25rem | 4   |
| `--space-2` | 0.5rem  | 8   |
| `--space-3` | 0.75rem | 12  |
| `--space-4` | 1rem    | 16  |
| `--space-5` | 1.5rem  | 24  |
| `--space-6` | 2rem    | 32  |
| `--space-7` | 3rem    | 48  |
| `--space-8` | 4rem    | 64  |

Radius: `--radius-sm` 4 px (inputs, chips), `--radius-md` 8 px (buttons, cards), `--radius-lg`
12 px (dialogs, sheets), `--radius-full` 999 px (pills, round buttons).

Shadow: `--shadow-1` for raised cards, `--shadow-2` for menus and popovers, `--shadow-3` for
dialogs. The dark theme uses stronger shadows because they are less visible on dark surfaces.

## Icons and social image

```bash
npm run icons
```

runs `scripts/generate-icons.mjs`, which reads the SVGs in `src/assets/brand/` and writes:

| Output                               | Size       | Source                  | Notes                                            |
| ------------------------------------ | ---------- | ----------------------- | ------------------------------------------------ |
| `public/favicon.svg`                 | vector     | `favicon.svg`           | Copied as is                                     |
| `public/favicon.ico`                 | 32         | `logo-mark-small.svg`   | One PNG in an ICO container, transparent         |
| `public/icons/icon-192.png`          | 192        | `logo-mark-inverse.svg` | Rounded brand-blue square, transparent corners   |
| `public/icons/icon-512.png`          | 512        | `logo-mark-inverse.svg` | Same as above                                    |
| `public/icons/icon-maskable-512.png` | 512        | `logo-mark-inverse.svg` | Full-bleed square, mark inside the 80% safe zone |
| `public/icons/apple-touch-icon.png`  | 180        | `logo-mark-inverse.svg` | Opaque square                                    |
| `public/og-image.png`                | 1200 x 630 | `og-image.svg`          | Logo, name and the one-line description          |

The script is deterministic, so a run without source changes leaves the files byte-identical.
After changing a brand SVG, run it and commit the outputs with the SVG. The icons are referenced from `index.html` and from the `manifest` block in `vite.config.ts`;
keep those two lists in sync with the files in `public/`.
