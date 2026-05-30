// settle/src/core/adjust.ts — framework-agnostic settle animation algorithm
import { SETTLE_CLASSES, type SettleOptions } from './types'

// ─── Pretext (canvas line detection) ─────────────────────────────────────────

type PretextModule = {
	prepareWithSegments: (text: string, font: string) => unknown
	layoutWithLines: (prepared: unknown, maxWidth: number, lineHeight: number) => { lines: { text: string }[] }
}

let _pretext: PretextModule | null = null
let _pretextLoading = false

function tryLoadPretext(): void {
	if (_pretext !== null || _pretextLoading) return
	_pretextLoading = true
	// @ts-ignore — optional peer dep; suppress "cannot find module" without a declaration stub
	import(/* @vite-ignore */ '@chenglou/pretext')
		.then((m) => { _pretext = m as PretextModule })
		.catch(() => {
			console.warn('[typsettle] canvas lineDetection requires @chenglou/pretext — falling back to BCR')
		})
}

type PreparedEntry = { originalHTML: string; prepared: unknown }
const pretextCache = new WeakMap<HTMLElement, PreparedEntry>()

function getCanvasFont(el: HTMLElement): string {
	const s = getComputedStyle(el)
	const family = s.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
	return `${s.fontWeight} ${s.fontSize} ${family}`
}

function getLineHeightPx(el: HTMLElement): number {
	const s = getComputedStyle(el)
	const lh = parseFloat(s.lineHeight)
	return isNaN(lh) ? parseFloat(s.fontSize) * 1.2 : lh
}

/**
 * Measure optical density of a text string by rendering to an off-screen canvas.
 * Returns ink pixel fraction in [0, 1] — higher = denser (more ink coverage).
 *
 * @param text     - Text string to render
 * @param font     - CSS font string (e.g. '400 16px Inter') matching the element
 * @param fontSize - Font size in px — used to size the canvas height
 */
function measureLineDensity(text: string, font: string, fontSize: number): number {
	if (!text.trim()) return 0
	const canvas = document.createElement('canvas')
	// Width: rough estimate (0.7 × fontSize per character covers most fonts)
	const width  = Math.ceil(fontSize * text.length * 0.7) || 1
	const height = Math.ceil(fontSize * 2)
	canvas.width  = width
	canvas.height = height
	const ctx = canvas.getContext('2d')
	if (!ctx) return 0
	ctx.font = font
	ctx.fillStyle = 'white'
	ctx.fillRect(0, 0, width, height)
	ctx.fillStyle = 'black'
	ctx.fillText(text, 0, fontSize * 1.2)
	const data = ctx.getImageData(0, 0, width, height).data
	let ink = 0
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] < 140) ink++
	}
	return ink / (width * height)
}

/** Resolved defaults applied when options are omitted */
const DEFAULTS = {
	spread: 0.04,
	duration: 800,
	easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
	stagger: 0,
}

/** Tags treated as atomic (not walked into; wrapped as a unit in a word span) */
const ATOMIC_TAGS = new Set(['img', 'svg', 'canvas', 'video', 'iframe', 'br', 'hr', 'input'])

type CollectedItem =
	| { type: 'text'; node: Text }
	| { type: 'atomic'; el: HTMLElement }

/**
 * Returns the innerHTML of an element with all settle-injected spans removed,
 * unwrapping their children in place. Idempotent and safe for complex markup.
 *
 * @param el - Element that may contain settle markup
 */
export function getCleanHTML(el: HTMLElement): string {
	const clone = el.cloneNode(true) as HTMLElement
	const settleSpans = clone.querySelectorAll(
		`.${SETTLE_CLASSES.word}, .${SETTLE_CLASSES.line}, .${SETTLE_CLASSES.probe}`,
	)
	settleSpans.forEach((node) => {
		const parent = node.parentNode
		if (!parent) return
		while (node.firstChild) parent.insertBefore(node.firstChild, node)
		parent.removeChild(node)
	})
	// Also remove any <br> elements injected between line spans
	clone.querySelectorAll('br[data-settle-br]').forEach((br) => br.parentNode?.removeChild(br))
	return clone.innerHTML
}

/**
 * Applies the settle page-load animation to an element.
 *
 * The algorithm runs five passes:
 *  1. Reset — restore the element to the original HTML snapshot
 *  2. Content collection — gather text nodes and atomic elements (img, svg, etc.)
 *  3. Line grouping — read BCR.top for each word span to detect visual lines
 *  4. Line span assembly — wrap each line's words in a letter-spacing span with a random offset
 *  5. Transition trigger — after one rAF, set letter-spacing to the target to trigger CSS transition
 *
 * @param element      - The live DOM element to animate (must be rendered and visible)
 * @param originalHTML - HTML snapshot taken before the first applySettle call
 * @param options      - SettleOptions (merged with defaults)
 */
export function applySettle(
	element: HTMLElement,
	originalHTML: string,
	options: SettleOptions = {},
): void {
	if (typeof window === 'undefined') return

	// Respect the active flag and the user's reduced-motion preference
	const active = options.active ?? true
	const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
	if (!active || prefersReducedMotion) {
		element.innerHTML = originalHTML
		return
	}

	// On e-ink / slow-update displays the CSS transition produces no visible effect.
	// Skip the random-offset phase entirely — just restore original HTML and return.
	// matchMedia('(update: slow)') is true on Kindle, Remarkable, and similar panels.
	if (window.matchMedia?.('(update: slow)')?.matches) {
		element.innerHTML = originalHTML
		return
	}

	// Save scroll position — iOS Safari does not support overflow-anchor: none
	const scrollY = window.scrollY

	const spread   = options.spread   ?? DEFAULTS.spread
	const duration = options.duration ?? DEFAULTS.duration
	const easing   = options.easing   ?? DEFAULTS.easing
	const stagger  = options.stagger  ?? DEFAULTS.stagger

	// --- Pass 1: Reset ---
	element.innerHTML = originalHTML

	// Guard empty element — nothing to animate
	if (!element.textContent?.trim()) {
		requestAnimationFrame(() => {
			if (Math.abs(window.scrollY - scrollY) > 2) {
				window.scrollTo({ top: scrollY, behavior: 'instant' })
			}
		})
		return
	}

	// Capture the element's existing letter-spacing as the settled baseline.
	// This way we respect any CSS letter-spacing already applied to the element
	// and treat it as the 0-point rather than overriding it with literal 0em.
	const computedStyle = getComputedStyle(element)
	const fontSizePx    = parseFloat(computedStyle.fontSize) || 16
	const originalLSPx  = parseFloat(computedStyle.letterSpacing) || 0
	const originalLSEm  = originalLSPx / fontSizePx

	// --- Pass 2: Content collection ---
	// Collect text nodes AND atomic inline elements via recursive childNodes walk
	// (NOT createTreeWalker — happy-dom bug skips inline ancestors like <em>, <strong>).
	// Atomic tags (img, svg, etc.) are treated as indivisible units: wrapped in a word
	// span in place so they participate in BCR line detection and buildLineHTML correctly.
	const items: CollectedItem[] = []
	;(function collectItems(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			items.push({ type: 'text', node: node as Text })
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement
			if (ATOMIC_TAGS.has(el.tagName.toLowerCase())) {
				items.push({ type: 'atomic', el })
			} else {
				node.childNodes.forEach(collectItems)
			}
		}
	})(element)

	const wordSpans: HTMLElement[] = []

	for (const item of items) {
		if (item.type === 'atomic') {
			// Wrap the atomic element in a word span in place
			const span = document.createElement('span')
			span.className = SETTLE_CLASSES.word
			item.el.parentNode!.insertBefore(span, item.el)
			span.appendChild(item.el)
			wordSpans.push(span)
			continue
		}

		const textNode = item.node
		const text = textNode.textContent ?? ''
		if (!text) continue

		// Split into alternating [whitespace, word, whitespace, word, …] tokens.
		// Odd-indexed entries (tokens[1], tokens[3], …) are words.
		const tokens = text.split(/(\S+)/)
		const fragment = document.createDocumentFragment()

		for (let i = 0; i < tokens.length; i += 2) {
			const space = tokens[i]        // whitespace gap before this word
			const word  = tokens[i + 1]   // word (undefined at end of string)
			if (!word) continue

			// Include trailing whitespace in the last word span of this text node
			// to avoid orphan text nodes at inline-element boundaries.
			const isLastWord = tokens[i + 3] === undefined
			const trailingSpace = isLastWord ? (tokens[i + 2] ?? '') : ''

			const span = document.createElement('span')
			span.className = SETTLE_CLASSES.word
			span.appendChild(document.createTextNode(space + word + trailingSpace))
			fragment.appendChild(span)
			wordSpans.push(span)
		}

		textNode.parentNode!.replaceChild(fragment, textNode)
	}

	// Guard: no word spans produced (e.g. whitespace-only content)
	if (wordSpans.length === 0) {
		requestAnimationFrame(() => {
			if (Math.abs(window.scrollY - scrollY) > 2) {
				window.scrollTo({ top: scrollY, behavior: 'instant' })
			}
		})
		return
	}

	// --- Pass 3: Line grouping ---
	// Canvas path: pretext arithmetic (no forced reflow on resize).
	// BCR path: getBoundingClientRect — ground truth for actual browser layout.

	const lineDetection = options.lineDetection ?? 'bcr'
	if (lineDetection === 'canvas') tryLoadPretext()

	const useCanvas = lineDetection === 'canvas' && _pretext !== null

	const lines: HTMLElement[][] = []

	if (useCanvas) {
		const cached = pretextCache.get(element)
		let prepared: unknown
		if (cached && cached.originalHTML === originalHTML) {
			prepared = cached.prepared
		} else {
			// Use per-span computed fonts for canvas measurement so mixed-size inline
			// elements (e.g. a <code> with smaller font-size) are measured correctly.
			// Fall back to root element font for spans that haven't rendered yet.
			const spanFonts = wordSpans.map((s) => getCanvasFont(s))
			const rootFont = getCanvasFont(element)
			const representativeFont = spanFonts[0] ?? rootFont
			prepared = _pretext!.prepareWithSegments(element.textContent ?? '', representativeFont)
			pretextCache.set(element, { originalHTML, prepared })
		}
		const { lines: pretextLines } = _pretext!.layoutWithLines(prepared, element.offsetWidth, getLineHeightPx(element))

		let si = 0
		for (let li = 0; li < pretextLines.length && si < wordSpans.length; li++) {
			const target = pretextLines[li].text.replace(/\s+/g, ' ').trim()
			const group: HTMLElement[] = []
			let acc = ''
			while (si < wordSpans.length) {
				const word = (wordSpans[si].textContent ?? '').replace(/\s+/g, ' ').trim()
				acc = acc ? acc + ' ' + word : word
				group.push(wordSpans[si])
				si++
				if (acc === target) break
			}
			if (group.length > 0) lines.push(group)
		}
		while (si < wordSpans.length) {
			lines[lines.length - 1]?.push(wordSpans[si++])
		}
	} else {
		// BCR path — batch all reads before any writes.
		// Normalize top by element line-height before rounding so mixed font-sizes
		// (e.g. <code> at text-xs inside a text-sm paragraph) don't straddle a line
		// boundary due to subpixel top differences that are smaller than the line-height step.
		const elementTop = element.getBoundingClientRect().top
		const lhPx = getLineHeightPx(element)
		const wordTops = wordSpans.map((w) =>
			Math.round((w.getBoundingClientRect().top - elementTop) / lhPx)
		)
		let currentTop = wordTops[0]
		let currentLine: HTMLElement[] = []
		for (let i = 0; i < wordSpans.length; i++) {
			if (wordTops[i] !== currentTop) {
				lines.push(currentLine)
				currentLine = []
				currentTop = wordTops[i]
			}
			currentLine.push(wordSpans[i])
		}
		lines.push(currentLine)
	}

	// --- Density target computation (optional) ---
	// When targetTracking is set, compute a per-line settling target before clearing DOM.
	// 'auto': measure canvas density per line → equalize around the average (±0.05em clamp).
	// number: all lines share the explicit em value.
	let targetTrackingValues: number[] | null = null
	const targetTrackingOption = options.targetTracking

	if (targetTrackingOption !== undefined) {
		if (typeof targetTrackingOption === 'number') {
			targetTrackingValues = lines.map(() => targetTrackingOption)
		} else {
			// 'auto' — per-line optical density via off-screen canvas
			const font     = getCanvasFont(element)
			const fontSize = parseFloat(getComputedStyle(element).fontSize)
			const densities = lines.map((lineWords) => {
				const text = lineWords.map((w) => (w.textContent ?? '').trim()).join(' ')
				return measureLineDensity(text, font, fontSize)
			})
			const avg = densities.reduce((a, b) => a + b, 0) / densities.length
			// Dense lines (above avg) get positive tracking to spread out.
			// Sparse lines (below avg) get negative tracking to tighten.
			const calibration = 2.0
			const maxAdj      = 0.05
			targetTrackingValues = densities.map((d) => {
				const raw = (d - avg) * calibration
				return Math.max(-maxAdj, Math.min(maxAdj, raw))
			})
		}
	}

	// --- Pass 4: Assemble line spans ---
	// Each line becomes an inline-block span with white-space:nowrap and a random
	// letter-spacing offset. A <br data-settle-br> between lines forces the visual break.
	const lineSpans: HTMLElement[] = []

	// Build new innerHTML by rebuilding from word spans' outerHTML, preserving
	// inline ancestor context (em, strong, a, etc.) for each word.
	const buildLineHTML = (lineWords: HTMLElement[]): string => {
		// Group consecutive words that share the same parent element so inline ancestors
		// (e.g. <code>, <em>) are emitted once per group, not once per word.
		type Group = { parent: Element | null; words: HTMLElement[] }
		const groups: Group[] = []
		for (const word of lineWords) {
			const parent = word.parentElement !== element ? word.parentElement : null
			const last = groups[groups.length - 1]
			if (last && last.parent === parent) {
				last.words.push(word)
			} else {
				groups.push({ parent, words: [word] })
			}
		}
		return groups.map(({ parent, words }) => {
			const inner = words.map(w => w.outerHTML).join('')
			if (!parent) return inner
			let html = inner
			let ancestor: Element | null = parent
			while (ancestor && ancestor !== element) {
				const shallow = ancestor.cloneNode(false) as Element
				const shallowHTML = shallow.outerHTML
				const split = shallowHTML.lastIndexOf('</')
				html = shallowHTML.slice(0, split) + html + shallowHTML.slice(split)
				ancestor = ancestor.parentElement
			}
			return html
		}).join('')
	}

	// Collect per-line HTML before clearing element
	const lineHTMLs = lines.map(buildLineHTML)

	// Generate random offsets (±spread em) for each line.
	// In 'expand' mode (default), the sign is preserved so lines start wide and settle inward.
	// In 'compress' mode, the sign is negated so lines start at zero and animate outward to natural.
	const direction = options.direction ?? 'expand'
	const rawOffsets = lines.map(() => (Math.random() * 2 - 1) * spread)
	const offsets = direction === 'compress'
		? rawOffsets.map((o) => -Math.abs(o))
		: rawOffsets

	// Write phase — replace element content with line spans.
	// The settled target for each line is originalLSEm + targetTracking adjustment.
	// The initial spacing starts from that target ± the random spread offset.
	// We emit "0" rather than "0.0000em" when the value is exactly zero for cleaner markup.
	let newHTML = ''
	for (let i = 0; i < lines.length; i++) {
		const trackingAdj    = targetTrackingValues ? targetTrackingValues[i] : 0
		const settledValue   = originalLSEm + trackingAdj
		// compress: start below settled value; expand: start above settled value
		const rawInitial     = direction === 'compress'
			? settledValue - Math.abs(offsets[i])
			: settledValue + offsets[i]
		const initialStr     = rawInitial === 0 ? '0' : `${rawInitial.toFixed(4)}em`
		const delay          = stagger > 0 ? `transition-delay:${i * stagger}ms;` : ''
		const transitionStyle = `transition:letter-spacing ${duration}ms ${easing};${delay}`
		newHTML +=
			`<span class="${SETTLE_CLASSES.line}" style="display:inline-block;white-space:nowrap;letter-spacing:${initialStr};${transitionStyle}">${lineHTMLs[i]}</span>`
		if (i < lines.length - 1) {
			newHTML += `<br data-settle-br>`
		}
	}

	element.innerHTML = newHTML

	// Collect the live line span elements after writing
	element.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`).forEach((span) => {
		lineSpans.push(span)
	})

	// --- Pass 5: Transition trigger ---
	// One rAF lets the browser paint the initial offset state, then setting
	// letter-spacing to the settled target triggers the CSS transition.
	// Settled target = originalLSEm + per-line density adjustment (if any).
	requestAnimationFrame(() => {
		lineSpans.forEach((span, i) => {
			const trackingAdj  = targetTrackingValues ? targetTrackingValues[i] : 0
			const settledValue = originalLSEm + trackingAdj
			span.style.letterSpacing = settledValue === 0 ? '0' : `${settledValue.toFixed(4)}em`
		})

		// Restore scroll position after DOM mutations (inner rAF for scroll restore)
		requestAnimationFrame(() => {
			if (Math.abs(window.scrollY - scrollY) > 2) {
				window.scrollTo({ top: scrollY, behavior: 'instant' })
			}
		})
	})
}

/**
 * Removes settle markup and restores the element to its original HTML.
 *
 * @param element      - The element that was previously animated
 * @param originalHTML - The snapshot passed to the original applySettle call
 */
export function removeSettle(element: HTMLElement, originalHTML: string): void {
	element.innerHTML = originalHTML
}

/**
 * Resets the element to its original HTML and re-runs the settle animation.
 * When options.quietReplay is true and stagger > 0, avoids the simultaneous all-lines
 * flash: instead each line briefly offsets from its settled state and eases back,
 * staggered across lines. Falls back to normal applySettle when stagger is 0.
 *
 * @param element      - The live DOM element to animate
 * @param originalHTML - HTML snapshot taken before the first applySettle call
 * @param options      - SettleOptions (merged with defaults)
 */
export function replaySettle(
	element: HTMLElement,
	originalHTML: string,
	options: SettleOptions = {},
): () => void {
	const stagger     = options.stagger ?? DEFAULTS.stagger
	const quietReplay = options.quietReplay ?? false

	if (!quietReplay) {
		removeSettle(element, originalHTML)
		applySettle(element, originalHTML, options)
		return () => {}
	}

	// quietReplay (stagger may be 0 — all lines animate simultaneously):
	// Find the existing line spans (already settled from a prior run), then
	// per-line: snap to offset, remove transition, let browser paint; then
	// restore transition and snap back to settled — all staggered.
	// If there are no existing line spans (e.g. first run), fall back to normal.
	const existingLineSpans = element.querySelectorAll<HTMLElement>(`.${SETTLE_CLASSES.line}`)
	if (existingLineSpans.length === 0) {
		removeSettle(element, originalHTML)
		applySettle(element, originalHTML, options)
		return () => {}
	}

	const spread   = options.spread   ?? DEFAULTS.spread
	const duration = options.duration ?? DEFAULTS.duration
	const easing   = options.easing   ?? DEFAULTS.easing
	const direction = options.direction ?? 'expand'

	// Read the current settled letter-spacing for each line before mutating anything
	const settledValues = Array.from(existingLineSpans).map((span) => {
		const ls = getComputedStyle(span).letterSpacing
		const px = parseFloat(ls) || 0
		// Convert back to em relative to span's own font-size
		const fs = parseFloat(getComputedStyle(span).fontSize) || 16
		return px / fs
	})

	const timerIds: ReturnType<typeof setTimeout>[] = []

	existingLineSpans.forEach((span, i) => {
		const delay = i * stagger

		const id = setTimeout(() => {
			const settledEm = settledValues[i]
			const rawOffset = (Math.random() * 2 - 1) * spread
			const offset    = direction === 'compress' ? -Math.abs(rawOffset) : rawOffset
			const offsetEm  = settledEm + offset

			// Snap to offset without a transition
			span.style.transition = 'none'
			span.style.letterSpacing = offsetEm === 0 ? '0' : `${offsetEm.toFixed(4)}em`

			// One rAF so the browser paints the offset state before re-enabling transition
			requestAnimationFrame(() => {
				span.style.transition = `letter-spacing ${duration}ms ${easing}`
				span.style.letterSpacing = settledEm === 0 ? '0' : `${settledEm.toFixed(4)}em`
			})
		}, delay)

		timerIds.push(id)
	})

	return () => { timerIds.forEach(clearTimeout) }
}
