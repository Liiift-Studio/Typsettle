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
	import('@chenglou/pretext' as string)
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
 *  2. Word wrap — wrap every word in a measurement span
 *  3. Line grouping — read BCR.top for each word span to detect visual lines
 *  4. Line span assembly — wrap each line's words in a letter-spacing span with a random offset
 *  5. Transition trigger — after one rAF, set letter-spacing to 0 to trigger CSS transition
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
	const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
	if (!active || prefersReducedMotion) {
		element.innerHTML = originalHTML
		return
	}

	// On e-ink / slow-update displays the CSS transition produces no visible effect.
	// Skip the random-offset phase entirely — just restore original HTML and return.
	// matchMedia('(update: slow)') is true on Kindle, Remarkable, and similar panels.
	if (window.matchMedia('(update: slow)').matches) {
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

	// --- Pass 2: Word wrap ---
	// Collect text nodes via recursive childNodes walk (NOT createTreeWalker — happy-dom bug).
	// Inserting into the correct parent preserves inline elements (<em>, <strong>, <a>, etc.).
	const textNodes: Text[] = []
	;(function collectTextNodes(node: Node) {
		if (node.nodeType === Node.TEXT_NODE) {
			textNodes.push(node as Text)
		} else {
			node.childNodes.forEach(collectTextNodes)
		}
	})(element)

	const wordSpans: HTMLElement[] = []

	for (const textNode of textNodes) {
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
			prepared = _pretext!.prepareWithSegments(element.textContent ?? '', getCanvasFont(element))
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
		// Round top values to integer pixels before comparing — subpixel BCR values differ
		// across browsers (Chrome/Firefox/Safari) and can cause same-line words to appear
		// on different lines if compared as raw floats.
		const wordTops = wordSpans.map((w) => Math.round(w.getBoundingClientRect().top))
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
		return lineWords
			.map((word) => {
				// Walk up to element to capture inline ancestor wrapping
				let html = word.outerHTML
				let ancestor: Element | null = word.parentElement
				while (ancestor && ancestor !== element) {
					const shallow = ancestor.cloneNode(false) as Element
					const shallowHTML = shallow.outerHTML
					const split = shallowHTML.lastIndexOf('</')
					html = shallowHTML.slice(0, split) + html + shallowHTML.slice(split)
					ancestor = ancestor.parentElement
				}
				return html
			})
			.join('')
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

	// Write phase — replace element content with line spans
	let newHTML = ''
	for (let i = 0; i < lines.length; i++) {
		const target         = targetTrackingValues ? targetTrackingValues[i] : 0
		// compress: start from target minus the spread offset (below natural spacing)
		// expand:   start from target plus the spread offset (above natural spacing)
		const initialSpacing = direction === 'compress'
			? (target - Math.abs(offsets[i])).toFixed(5)
			: (target + offsets[i]).toFixed(5)
		const delay          = stagger > 0 ? `transition-delay:${i * stagger}ms;` : ''
		const transitionStyle = `transition:letter-spacing ${duration}ms ${easing};${delay}`
		newHTML +=
			`<span class="${SETTLE_CLASSES.line}" style="display:inline-block;white-space:nowrap;letter-spacing:${initialSpacing}em;${transitionStyle}">${lineHTMLs[i]}</span>`
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
	// letter-spacing to the target triggers the CSS transition → lines ease to equilibrium.
	// Target is 0em by default; density-equalized values when targetTracking is set.
	requestAnimationFrame(() => {
		lineSpans.forEach((span, i) => {
			const target = targetTrackingValues ? targetTrackingValues[i] : 0
			span.style.letterSpacing = `${target.toFixed(5)}em`
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
 * Equivalent to calling removeSettle followed by applySettle.
 *
 * @param element      - The live DOM element to animate
 * @param originalHTML - HTML snapshot taken before the first applySettle call
 * @param options      - SettleOptions (merged with defaults)
 */
export function replaySettle(
	element: HTMLElement,
	originalHTML: string,
	options: SettleOptions = {},
): void {
	removeSettle(element, originalHTML)
	applySettle(element, originalHTML, options)
}
