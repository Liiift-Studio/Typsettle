// settle/src/react/useSettle.ts — React hook for the settle animation
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { applySettle, getCleanHTML, removeSettle } from '../core/adjust'
import type { SettleOptions } from '../core/types'

/** Props accepted by useSettle in addition to SettleOptions */
export interface UseSettleOptions extends SettleOptions {
	/** When false, the animation is skipped entirely (useful for SSR / reduced-motion overrides). Default: true */
	active?: boolean
}

/**
 * React hook that applies the settle effect to a ref'd element on mount.
 * Skips the animation when active=false or when the user prefers reduced motion.
 * Re-runs on element width changes detected via ResizeObserver.
 *
 * @param options - UseSettleOptions (all fields optional)
 * @returns ref to attach to the target element
 */
export function useSettle(options: UseSettleOptions = {}) {
	const ref = useRef<HTMLElement>(null)
	const originalHTMLRef = useRef<string | null>(null)
	const optionsRef = useRef(options)
	optionsRef.current = options

	/** Returns true if the animation should be suppressed */
	const shouldSkip = useCallback(() => {
		const { active = true } = optionsRef.current
		if (!active) return true
		if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
			return true
		}
		return false
	}, [])

	const { spread, duration, stagger, active } = options

	const run = useCallback(() => {
		const el = ref.current
		if (!el) return

		if (originalHTMLRef.current === null) {
			originalHTMLRef.current = getCleanHTML(el)
		}

		if (shouldSkip()) {
			// Ensure the element shows its clean original state when skipping
			removeSettle(el, originalHTMLRef.current)
			return
		}

		applySettle(el, originalHTMLRef.current, optionsRef.current)
	}, [shouldSkip, spread, duration, stagger, active])

	useLayoutEffect(() => {
		run()

		if (typeof ResizeObserver === 'undefined') return

		let lastWidth = 0
		let rafId = 0
		const ro = new ResizeObserver((entries) => {
			const w = Math.round(entries[0].contentRect.width)
			if (w === lastWidth) return
			lastWidth = w
			cancelAnimationFrame(rafId)
			rafId = requestAnimationFrame(run)
		})
		ro.observe(ref.current!)
		return () => {
			ro.disconnect()
			cancelAnimationFrame(rafId)
		}
	}, [run])


	// Rerun after all fonts finish loading — line detection uses BCR which
	// gives wrong results if the font has not yet swapped in.
	useEffect(() => {
		document.fonts.ready.then(run)
	}, [run])

	return ref
}
