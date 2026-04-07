// settle/src/core/types.ts — types and class constants

/** Options for the settle page-load animation */
export interface SettleOptions {
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
}

/** CSS class names injected by settle — use these to target generated markup */
export const SETTLE_CLASSES = {
	word: 'settle-word',
	line: 'settle-line',
	probe: 'settle-probe',
} as const
