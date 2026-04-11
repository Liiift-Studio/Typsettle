// settle/src/core/types.ts — types and class constants

/** Options for the settle page-load animation */
export interface SettleOptions {
	/**
	 * Line detection method. Default: 'bcr'
	 *
	 * - **'bcr'** (default) — uses `getBoundingClientRect()` on injected word spans.
	 *   Ground truth: reads actual browser layout, handles all inline HTML and any font.
	 *
	 * - **'canvas'** — uses `@chenglou/pretext` canvas measurement for arithmetic line
	 *   breaking. No forced reflow on resize. Requires `@chenglou/pretext` to be installed.
	 *   Falls back to 'bcr' on the first render while pretext loads.
	 *   Avoid with `system-ui` font (canvas resolves differently on macOS).
	 */
	lineDetection?: 'bcr' | 'canvas'
	/** Max initial letter-spacing offset in em (default: 0.04) */
	spread?: number
	/** Animation duration in ms (default: 800) */
	duration?: number
	/** CSS easing string (default: 'cubic-bezier(0.25, 0.1, 0.25, 1)') */
	easing?: string
	/** Delay between lines in ms; 0 means all lines settle together (default: 0) */
	stagger?: number
	/** When false, skip the animation entirely (default: true) */
	active?: boolean
	/**
	 * Target letter-spacing value each line settles to. Default: 0em (natural spacing).
	 *
	 * - **omitted** — lines settle to `0em` letter-spacing.
	 *
	 * - **number** — all lines settle to this explicit em value. Positive adds tracking;
	 *   negative subtracts it. Useful for a consistent loose or tight equilibrium.
	 *
	 * - **'auto'** — optical density is measured per line via an off-screen canvas.
	 *   The target density is the average across all lines. Lines denser than average
	 *   receive positive tracking; sparse lines receive negative tracking. Each line
	 *   settles to its individual density-equalizing value. Clamped to ±0.05em.
	 *   The animation still starts from a random offset — settle becomes double-purposeful:
	 *   it animates AND equalizes density simultaneously.
	 */
	targetTracking?: number | 'auto'
}

/** CSS class names injected by settle — use these to target generated markup */
export const SETTLE_CLASSES = {
	word: 'settle-word',
	line: 'settle-line',
	probe: 'settle-probe',
} as const
