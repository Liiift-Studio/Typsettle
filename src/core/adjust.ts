// settle/src/core/adjust.ts — framework-agnostic settle animation algorithm
import { SETTLE_CLASSES, type SettleOptions } from './types'

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

	// --- Pass 3: Line grouping via BCR.top ---
	// Batch all layout reads before writes to avoid layout thrashing.
	const wordTops = wordSpans.map((w) => w.getBoundingClientRect().top)

	// Group word spans into lines by matching BCR.top values.
	const lines: HTMLElement[][] = []
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

	// Generate random offsets (±spread em) for each line
	const offsets = lines.map(() => (Math.random() * 2 - 1) * spread)

	// Write phase — replace element content with line spans
	let newHTML = ''
	for (let i = 0; i < lines.length; i++) {
		const offset = offsets[i]
		const delay  = stagger > 0 ? `transition-delay:${i * stagger}ms;` : ''
		const transitionStyle = `transition:letter-spacing ${duration}ms ${easing};${delay}`
		newHTML +=
			`<span class="${SETTLE_CLASSES.line}" style="display:inline-block;white-space:nowrap;letter-spacing:${offset}em;${transitionStyle}">${lineHTMLs[i]}</span>`
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
	// letter-spacing to 0 triggers the CSS transition → lines ease to zero.
	requestAnimationFrame(() => {
		lineSpans.forEach((span) => {
			span.style.letterSpacing = '0em'
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
