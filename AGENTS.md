# AGENTS.md

Guidance for AI agents and contributors working in this repository.

## Purpose

Aquatubos is a web app (PWA) that teaches civil engineering students to design water distribution
networks. The player changes pipe diameters in five stages until the network meets the criteria
of ABNT NBR 12218:2017, with every calculation shown and checkable by hand. It succeeds the
original Aquatubos (Unity, 2021), an undergraduate thesis app
(<https://github.com/jvsena42/aquaplay_tcc>).

Live site: <https://jvsena42.github.io/aquatubos/>. Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Visual identity: [docs/BRAND.md](docs/BRAND.md).

## Commands

Node 22.12 or newer (CI uses the version in `.nvmrc`). Package manager: npm.

| Task                                              | Command                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| Install                                           | `npm ci`                                            |
| Dev server                                        | `npm run dev`                                       |
| Lint (ESLint + Prettier check)                    | `npm run lint`                                      |
| Format                                            | `npm run format`                                    |
| Typecheck                                         | `npm run typecheck`                                 |
| Unit tests                                        | `npm test`                                          |
| One test file                                     | `npx vitest run path/to/file.test.ts`               |
| Coverage (fails under 80 % lines in `src/engine`) | `npm run coverage`                                  |
| Build                                             | `npm run build`                                     |
| Preview the build                                 | `npm run preview`                                   |
| End-to-end tests (Playwright)                     | `npm run e2e`                                       |
| Recompute reference solutions                     | `npm run reference` (`WRITE=1` to update the files) |
| Regenerate icons from the SVG logo                | `npm run icons`                                     |
| Regenerate README screenshots                     | `npm run screenshots`                               |

The app is served under `/aquatubos/` in dev, preview and production.
`npm run e2e` needs a Playwright browser: `npx playwright install chromium`.

## Folder layout

```
src/
  engine/          hydraulic engine: pure TypeScript, SI units, no DOM
    config/nbr12218.ts   the only place with NBR 12218 limits
    data/pipeCatalog.json  commercial diameters and illustrative prices
  scenarios/       stage files (stages/*.json), their type, loader, validator
  game/            scenario → network, evaluation, stars, system curve, reference search,
                   house counts; game/town is the procedural town generator
  worker/          Web Worker that runs the evaluation, and its client
  state/store.ts   Zustand store
  persistence/     Dexie (IndexedDB) for progress and preferences
  i18n/            useTr() and useFormat()
  styles/          tokens.css (design tokens), global.css (shared classes)
  ui/              React components by feature: home (title screen), stages (stage map),
                   stage (stage screen), hud, town (illustrated view), network (schematic),
                   panels, charts, glossary, shell; ui/three is the lazy 3D view
  assets/brand/    logo sources
scripts/           icon generation, reference solutions, screenshots
e2e/               Playwright tests
docs/              ARCHITECTURE.md, BRAND.md, screenshots
```

## Coding conventions

- TypeScript strict, including `noUncheckedIndexedAccess`. No `any`.
- `src/engine` imports nothing from outside `src/engine`. `three` and `@react-three/fiber` are
  imported only under `src/ui/three`.
- Engine results are plain JSON-compatible data (they cross the worker boundary).
- UI text is Portuguese (pt-BR) first with English: `{ pt, en }` objects in a `strings.ts` next to
  the component, read with `useTr()`. Numbers go through `useFormat()`.
- Styling is plain CSS next to the component with BEM-style class names. Colours, fonts, spacing
  and radii come from `src/styles/tokens.css`; never hard-code a colour. Status is never shown by
  colour alone: pair it with an icon or a label.
- Tests live next to the code as `*.test.ts(x)`. Engine tests show the hand calculation in a
  comment.
- Comments and docs in plain prose.

## Commit conventions

- Conventional Commits: `feat`, `fix`, `test`, `docs`, `ci`, `chore`, `refactor`, `build`, with an
  optional scope, for example `feat(engine): add minor losses`.
- Small atomic commits, one logical change each.
- Subject in the imperative, at most about 72 characters, no trailing period. Add a body that
  explains why when it is not obvious.
- Every commit leaves lint, typecheck and tests passing.
- Never commit build output, coverage, `node_modules` or secrets.
- Merge pull requests with a merge commit or a rebase. Do not squash.

## Engineering invariants

These must not break. Each has tests; keep them.

1. **SI inside the engine.** m, m³/s, m/s. L/s, mm and mca exist only in scenario files and in
   the UI. Pressure is a head in metres; nothing is compared against a kPa value.
2. **Hazen-Williams takes the coefficient C** (for example 140), not an absolute roughness.
   Absolute roughness ε belongs to Darcy-Weisbach only. `Pipe` has both fields; do not mix them.
3. **Hardy Cross uses signed flows and signed head losses.** `Σh` around a loop is a signed sum
   and tends to zero; `ΔQ = −Σh / Σ(n·|h|/|Q|)`.
4. **NBR 12218 constants live in `src/engine/config/nbr12218.ts` only.** Checks, UI and docs read
   them from there.
5. **Every stage is solvable and starts failing.** `src/scenarios/stages.test.ts` asserts that the
   reference solution passes every check and the initial design fails at least one.
6. **The solver agrees with EPANET** on the reference networks in `src/engine/epanet.test.ts`.
7. **Hardy Cross agrees with the GGA solver** on looped networks.

## How to add a stage

1. Copy a file in `src/scenarios/stages/` to `stageN.json`. Set `id`, `order`, the texts in pt and
   en, nodes, reservoirs, pipes (with a failing `initialDN`), pumps, `checks`, `features`,
   `profilePath` and, for looped stages, `loops`. See the field table in
   [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#scenario-files).
2. Import it in `src/scenarios/index.ts`.
3. Run `WRITE=1 npm run reference` to compute and store the reference solution (and the budget if
   the stage has one). If it reports that no design passes, change the scenario.
4. Update the expected stage list in `src/scenarios/stages.test.ts` and run `npm test`. The
   per-stage tests run for the new file automatically.
5. Play it: `npm run dev`. The town (streets, houses, trees, park, hill shading) is generated
   from the geometry, seeded by the stage id; no drawing work is needed. Each demand node gets
   3 houses per L/s (2 to 12). Keep nodes at least about 150 m apart in plan so streets, houses
   and labels fit at phone width. To adjust the scenery add an optional `town` block (`seed`,
   `park`, `landmarks`, `extraHouses`, `scenery`) or `kind` on a reservoir; the fields are
   described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#town-view).
6. The stage map (`src/ui/stages/mapLayout.ts`) is laid out for five neighbourhoods; add one
   there for a sixth stage.

## How to add a head loss formula

1. Add the name to `HeadLossFormula` in `src/engine/types.ts`.
2. Implement it in `src/engine/headloss.ts` and add a branch in `pipeLoss` returning the signed
   head loss, a positive derivative and the exponent `n`.
3. Add tests with hand-computed values to `headloss.test.ts`, including the derivative against a
   finite difference.
4. Add it to the formula selector (`FORMULAS` in `src/ui/stage/StageScreen.tsx`, labels in
   `src/ui/stage/strings.ts`) and write out its steps in the calculation panel
   (`src/ui/panels/CalcPanel.tsx`).

## How to add a check

1. Add the limit to `src/engine/config/nbr12218.ts` and to `CheckLimits`; add the id to `CheckId`
   in `src/engine/types.ts`.
2. Implement it in `runChecks` (`src/engine/checks.ts`) with an explanation in pt and en that
   states the value, the limit and what to change.
3. Add the setting to every scenario file's `checks` and to `DEFAULT_CHECK_SETTINGS`.
4. Add tests to `checks.test.ts`, then run `npm run reference` to see whether any reference
   solution changes.

## Before pushing

Run all of these; CI runs the same:

```
npm run lint
npm run typecheck
npm run coverage
npm run build
```

For UI changes also run `npm run e2e` and look at the result in a browser in light and dark
themes and at phone width.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist` to GitHub
Pages (source: GitHub Actions). Work on a branch, open a pull request, wait for CI, merge without
squashing. The Vite `base` (`/aquatubos/`) must match the repository name; if the repository is
renamed, update `vite.config.ts`, `index.html`, `playwright.config.ts` and the URLs in the docs.
