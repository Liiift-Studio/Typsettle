# settle

> Page-load animation where per-line tracking starts at random offsets and eases to optical equilibrium — like watching a compositor tune a paragraph

## Concept

On mount, each line is assigned a random letter-spacing offset (±0.04em). Over ~800ms, every line eases toward its optically optimal tracking value. The paragraph looks like a compositor fine-tuning it in real time. Stops when settled. Can combine with gray-value as the target state.

## Install

```bash
npm install settle
```

## Usage

### React

```tsx
import { SettleText } from 'settle'

<SettleText>
  Your paragraph text here.
</SettleText>
```

### Vanilla JS

```ts
import { applySettle, getCleanHTML } from 'settle'

const el = document.querySelector('p')
const original = getCleanHTML(el)
applySettle(el, original, { /* options */ })
```

## Options

| Option | Description |
|--------|-------------|
| `spread` | max initial offset in em, default 0.04 |
| `duration` | ms, default 800 |
| `easing` | CSS easing string |
| `target` | 'zero' | 'gray-value' |
| `stagger` | delay between lines in ms |

## Development

```bash
npm install
npm test
npm run build
```

---

Part of the [Liiift Studio](https://liiift.studio) typography tools family.
See also: [Ragtooth](https://ragtooth.liiift.studio)
