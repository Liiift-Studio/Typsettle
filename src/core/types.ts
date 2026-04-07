// settle/src/core/types.ts — types and class constants
export interface SettleOptions {
	// spread (max initial offset in em, default 0.04)
	// duration (ms, default 800)
	// easing (CSS easing string)
	// target ('zero' | 'gray-value')
	// stagger (delay between lines in ms)
}

/** CSS class names injected by settle — use these to target generated markup */
export const SETTLE_CLASSES = {
	word: 'settle-word',
	line: 'settle-line',
	probe: 'settle-probe',
} as const
