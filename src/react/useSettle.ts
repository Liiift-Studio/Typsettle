// settle/src/react/useSettle.ts — React hook for the settle animation
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { applySettle, getCleanHTML, removeSettle, replaySettle } from '../core/adjust'
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
 * When intersect=true, re-runs the animation each time the element enters the viewport.
 *
 * @param options - UseSettleOptions (all fields optional)
 * @returns object with ref to attach to the target element and a replay function
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
		if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
			return true
		}
		return false
	}, [])

	const { intersect } = options

	const hasSettledOnce = useRef(false)

	// All animation options (spread, duration, easing, direction, etc.) are read from
	// optionsRef.current inside run, so they do not belong in the dependency array.
	// Only shouldSkip is listed because it also reads from optionsRef and is a stable
	// useCallback itself — omitting it would cause run to capture a stale shouldSkip.
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
		hasSettledOnce.current = true
	}, [shouldSkip])

	// Tracks the cancel function returned by the most recent replaySettle call.
	const cancelReplayRef = useRef<(() => void) | null>(null)

	/** Imperatively replay the settle animation from the original HTML snapshot */
	const replay = useCallback(() => {
		const el = ref.current
		if (!el || originalHTMLRef.current === null) return
		cancelReplayRef.current?.()
		cancelReplayRef.current = replaySettle(el, originalHTMLRef.current, optionsRef.current)
	}, [])

	// Cancel any in-flight stagger timers when the component unmounts.
	useEffect(() => {
		return () => { cancelReplayRef.current?.() }
	}, [])

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
		if (!ref.current) return
		ro.observe(ref.current)
		return () => {
			ro.disconnect()
			cancelAnimationFrame(rafId)
		}
	}, [run])


	// Rerun after all fonts finish loading — line detection uses BCR which
	// gives wrong results if the font has not yet swapped in.
	useEffect(() => {
		document.fonts?.ready?.then(run)
	}, [run])

	// Intersection Observer — re-run animation each time element enters viewport.
	// After the initial settle, uses replay() instead of run() to avoid the
	// innerHTML reset that run()/applySettle() does — prevents layout shift mid-scroll.
	// Only active when intersect=true and IntersectionObserver is available.
	useEffect(() => {
		if (!intersect) return
		if (typeof IntersectionObserver === 'undefined') return
		const el = ref.current
		if (!el) return

		const io = new IntersectionObserver((entries) => {
			if (!entries[0].isIntersecting) return
			if (hasSettledOnce.current) {
				replay()
			} else {
				run()
			}
		})
		io.observe(el)
		return () => io.disconnect()
	}, [intersect, run, replay])

	return { ref, replay }
}
