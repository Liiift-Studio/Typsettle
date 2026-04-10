# Typsettle

Page-load animation where per-line tracking starts at random offsets and eases to optical equilibrium — like watching a compositor tune a paragraph. Runs once on mount, leaves no trace in the DOM.

**[typsettle.com](https://typsettle.com)** · [npm](https://www.npmjs.com/package/@liiift-studio/typsettle) · [GitHub](https://github.com/Liiift-Studio/Typsettle)

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

<SettleText spread={0.04} duration={800} stagger={0}>
  Your paragraph text here...
</SettleText>
```

### React hook

```tsx
import { useSettle } from '@liiift-studio/typsettle'

function Paragraph({ children }) {
  const ref = useSettle({ spread: 0.04, duration: 800 })
  return <p ref={ref}>{children}</p>
}
```

### Vanilla JS

```ts
import { applySettle, getCleanHTML } from '@liiift-studio/typsettle'

const el = document.querySelector('p')
const originalHTML = getCleanHTML(el)

applySettle(el, originalHTML, { spread: 0.04, duration: 800 })
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `lineDetection` | `'bcr' \| 'canvas'` | `'bcr'` | Line detection method — `'bcr'` reads browser layout; `'canvas'` uses `@chenglou/pretext` for zero-reflow resize |
| `spread` | `number` | `0.04` | Max initial letter-spacing offset in em |
| `duration` | `number` | `800` | Animation duration in ms |
| `easing` | `string` | `'cubic-bezier(0.25, 0.1, 0.25, 1)'` | CSS easing function |
| `stagger` | `number` | `0` | Delay between lines in ms — `0` settles all lines together |
| `active` | `boolean` | `true` | When `false`, skips the animation entirely |

---

## Dev notes

### `next` in root devDependencies

`package.json` at the repo root lists `next` as a devDependency. This is a **Vercel detection workaround** — not a real dependency of the npm package. Vercel's build system inspects the root `package.json` to detect the framework; without `next` present it falls back to a static build and skips the Next.js pipeline, breaking the `/site` subdirectory deploy.

The package itself has zero runtime dependencies. Do not remove this entry.

---

Current version: v1.0.0
