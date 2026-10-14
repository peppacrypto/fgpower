# FGPOWER design system — "clean light" (2026-10)

The interface is a calm, light sports app for daily use. Strength shows in the
content — exercise photos, loads, reps, progress — while the chrome stays quiet:
one sober green for action and selection, soft hairlines, rounded shapes, and
type hierarchy instead of labels shouting in small caps. The public site and the
app speak the same visual language.

Tokens and shared classes live in `src/app/globals.css`; primitives in
`src/components/ui/`. Use tokens only — never raw hex in components (the one
exception is the dark-only brand lime of the logo on dark artwork).

## Palette (semantic tokens)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F7F8F6` | `#0F1412` | Page |
| `surface` | `#FFFFFF` | `#161C19` | Cards, forms, panels, sheets' content |
| `surface-2` | `#F0F2EF` | `#1D2421` | Tonal fill: secondary buttons, chips, table heads, wells |
| `border` | `#E1E6E1` | `#29312D` | Hairlines between and around things |
| `border-strong` | `#CDD4CE` | `#3A443E` | A firmer hairline (hover, outline buttons) |
| `field` | `#848F88` | `#68756D` | Form-field boundary (≥3:1, WCAG 1.4.11) |
| `foreground` | `#17201B` | `#E8EDE9` | Titles, content, values |
| `muted` | `#5E6A63` | `#9BA69F` | Descriptions, metadata (≥5:1) |
| `accent` | `#246B4A` | `#6CC79A` | The main action, selection, links |
| `accent-hover` | `#1C543A` | `#86D4AD` | Hover/pressed of the main action |
| `accent-soft` | `#ECF3ED` | `#16271E` | Supporting highlight, selected plate |
| `success` / `warning` / `danger` (+ `-soft`) | | | States — always with words or a symbol too |
| `tag-*-bg/fg` | | | Category hues (goal/track). Use sparingly: a dot or a small chip, never a whole card |

`accent-strong` is an alias of `accent` (the old neon lime is retired from the
UI). Color only ever means action, selection or state, and a state is also
readable as text or a symbol.

## Type

- Inter everywhere. Body 15–16px, line-height 1.45–1.6; secondary text 13–14px.
  Never put an instruction the user needs in text under 12px.
- Weights: 600 for interface titles (h1–h3, card titles, buttons); 400–500 for
  body; 700 only for the few display headlines (landing hero, big numbers).
- Page title: `text-[1.75rem] sm:text-[2rem] font-semibold leading-tight text-display`.
- Section title: `text-[17px] font-semibold` (the `SectionHead` component).
- Card title: `text-base font-semibold` (or `text-[17px]`).
- Small line above a title or section: the `.eyebrow` class (13px, medium,
  muted, **sentence case**). Add `text-accent` only when it marks the screen's
  primary thing ("Próximo treino").
- Numbers (load, reps, time, counts, charts): `tabular-nums` in Inter. The mono
  font (`font-mono`) is no longer a general style — keep it only where a
  monospace glyph genuinely matters (none expected in normal screens).
- No `uppercase` + wide `tracking-[0.1x em]` micro-labels. Write the words in
  normal sentence case ("Esta semana", "Séries do treino", "Seg · Ter").
  Short unit suffixes stay lowercase ("kg", "min", "reps").

## Shape, space, elevation

- Radii: chips `rounded-[var(--radius-sm)]` (6px); buttons/fields/small tiles
  `rounded-[var(--radius-md)]` (10px); cards `rounded-[var(--radius-lg)]`
  (14px); heroes/sheets `rounded-[var(--radius-xl)]` (20px); avatars and the
  switch `rounded-full`. Repeat the same family; no 0/2/3px corners.
- Spacing in 4/8px steps. Cards pad `p-4` on phones, `p-5`/`p-6` from `sm`.
  Sections are separated by space (`mt-8`/`mt-10`), not by heavy rules.
- Borders: 1px `border-border` hairlines. No 2px "heavy rules", no
  `border-y-2`, `border-t-2 border-t-[var(--rule-heavy)]`, left keels
  (`border-l-4`), dashed boxes or corner marks.
- Shadow only where something floats or lifts: sheets, sticky bars, the iOS
  install banner (`shadow-[var(--shadow-md)]`), a hovered link card
  (`--shadow-sm`).

## Shared classes (globals.css)

| Class | What |
| --- | --- |
| `.card` | The one container: surface + 1px border + 14px radius. `.is-link` when the whole card is clickable; `data-active="true"` for the selected/current one |
| `.panel` | The screen's lead block: a card with 20px radius + soft shadow (Today's next workout, a program's masthead, the summary verdict, error/404 panels) |
| `.sheet` | A bottom sheet / dialog body (rounded top on phones, all round from `sm`) |
| `.eyebrow` | The small muted line above a title/section |
| `.tag` + `.tag--field` (dot + words), `.tag--spec` (value chip), `.tag--mark` (green highlight chip), `.tag--status .tag--ok/warn/bad/info` (symbol + words) | Chips/labels, sentence case |
| `.hit` | 44px touch target around a smaller control |

## Components

- `Button` (`ui/button.tsx`): `primary` (= `strong`) filled green for **the**
  main action of a screen; `secondary` tonal; `outline` white with a border;
  `ghost`; `danger`; `link`. Sizes `sm` (36px look, 44px hit), `md` 44, `lg` 48,
  `bar` full width. One primary per view region.
- `Badge`: small tinted chip, sentence case.
- `Input`/`Select`/`Textarea`: 10px radius, `border-field`, 16px text on phones.
- `Card`/`.card`, `Masthead` (eyebrow + page title + lead + action),
  `SectionHead` (section title + count + action), `EmptyState` (a centered card),
  `ActionSheet`/`ConfirmSheet`, `Toggle` (round switch), skeleton `Bone`.
- Icons: lucide-react plus the house glyphs in `ui/glyph.tsx` (same 24px grid,
  round caps); `GArrow` is a forward arrow for CTAs/"open". Important actions
  carry a text label, not an icon alone.
- Bottom nav: the lit tab's icon sits on a soft green pill and its label turns
  semibold. Sidebar: the lit link is a soft green plate.

## Content hierarchy rules

- Each screen has one evident priority: the next workout on Today, the current
  exercise and its set rows in a workout, the name + purpose + weekly commitment
  on a program card.
- Lead with what helps the decision; move detail one layer down (`<details>`,
  a sheet, the detail page). Never hide what's essential to executing a set
  safely.
- No decorative numbering ("01", "Fig. 02", "§") — order is reading order.
- Keep every data attribute, aria attribute, role, label and copy that behavior
  or tests depend on; this system changes presentation, not logic.

## Dark mode

Same tokens, same hierarchy (`:root[data-theme="dark"]` and the
`prefers-color-scheme` block). Never special-case a component with `dark:`
colors when a token exists.
