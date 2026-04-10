# Typsettle

Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful. Like watching a compositor tune a paragraph. Runs once on mount, leaves no trace in the DOM. Respects `prefers-reduced-motion`.

**[typsettle.com](https://typsettle.com)** · [npm](https://www.npmjs.com/package/@liiift-studio/typsettle) · [GitHub](https://github.com/Liiift-Studio/Typsettle)

TypeScript · Zero dependencies · React + Vanilla JS

---

## Install

```bash
npm install @liiift-studio/typsettle
```

---

## Usage

### React component

```tsx
import { SettleText } from '@liiift-studio/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>
```

### React hook

```tsx
import { useSettle } from '@liiift-studio/typsettle'

const ref = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
<p ref={ref}>{children}</p>
```

### Vanilla JS

```ts
import { applySettle, getCleanHTML } from '@liiift-studio/typsettle'

const el = document.querySelector('p')
const original = getCleanHTML(el)
applySettle(el, original, { spread: 0.04, duration: 800, stagger: 80 })
```

---

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `spread` | `0.04` | Max initial letter-spacing offset in em. Each line gets a random value in `[-spread, +spread]` |
| `duration` | `800` | CSS transition duration in ms |
| `easing` | `'cubic-bezier(0.25, 0.1, 0.25, 1)'` | CSS easing string |
| `stagger` | `0` | Delay between lines in ms. `0` settles all lines together; `80` gives a cascading effect |
| `active` | `true` | Set `false` to skip the animation entirely (e.g. for conditional disabling) |
| `lineDetection` | `'bcr'` | `'bcr'` reads actual browser layout — ground truth, works with any font and inline HTML. `'canvas'` uses [`@chenglou/pretext`](https://github.com/chenglou/pretext) for arithmetic line breaking with no forced reflow on resize. Install pretext separately |
| `as` | `'p'` | HTML element to render, e.g. `'h1'`, `'div'`. *(React component only)* |

---

## How it works

Each visual line is wrapped in a `<span>`. A random `letter-spacing` value in `[-spread, +spread]` em is applied immediately. On the next `requestAnimationFrame`, a CSS transition is set on each span and `letter-spacing` is cleared — the browser then animates each line back to zero. Stagger is implemented by adding `i × stagger` ms to each line's `transition-delay`. Once all transitions complete, the injected spans are removed and the element is restored to its original HTML. The animation is skipped entirely if `prefers-reduced-motion: reduce` is set.

---

## Dev notes

### `next` in root devDependencies

`package.json` at the repo root lists `next` as a devDependency. This is a **Vercel detection workaround** — not a real dependency of the npm package. Vercel's build system inspects the root `package.json` to detect the framework; without `next` present it falls back to a static build and skips the Next.js pipeline, breaking the `/site` subdirectory deploy.

The package itself has zero runtime dependencies. Do not remove this entry.

---

## Future improvements

- **Intersection Observer trigger** — re-run the animation each time the element scrolls into view, not just on mount
- **Direction option** — `'expand'` (current: lines start tight and widen to normal) vs `'compress'` (lines start loose and tighten to normal)
- **Variable font axis settle** — settle `wdth` or `wght` instead of (or alongside) letter-spacing, for fonts where axis variation reads more clearly at large sizes
- **Replay API** — expose a `replay()` method so callers can re-trigger the animation on demand (e.g. after a route change in a SPA)
- **Random seed** — accept a `seed` option for deterministic random offsets, so SSR-rendered markup matches the client hydration state

---

Current version: v1.0.0
