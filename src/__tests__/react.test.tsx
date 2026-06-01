// settle/src/__tests__/react.test.tsx — @testing-library/react hook and component tests
import React from 'react'
import { render, renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSettle } from '../react/useSettle'
import { SettleText } from '../react/SettleText'
import { SETTLE_CLASSES } from '../core/types'

// ─── DOM measurement mock ──────────────────────────────────────────────────────
// Mirrors the pattern from adjust.test.ts: probe spans → 0, word spans → WORD_WIDTH,
// everything else → CONTAINER_WIDTH. BCR.top cycles so bcr-mode line detection works.

const CONTAINER_WIDTH = 600
const WORD_WIDTH = 80
let wordIndex = 0

/** Install offsetWidth / getBoundingClientRect mocks and return a restore function. */
function mockMeasurement() {
	wordIndex = 0

	const proto = HTMLElement.prototype
	const priorOffsetWidth = Object.getOwnPropertyDescriptor(proto, 'offsetWidth')

	Object.defineProperty(proto, 'offsetWidth', {
		configurable: true,
		get: function (this: HTMLElement) {
			if (this.classList?.contains(SETTLE_CLASSES.probe)) return 0
			if (this.classList?.contains(SETTLE_CLASSES.word)) return WORD_WIDTH
			return CONTAINER_WIDTH
		},
		// no-op setter so happy-dom constructor does not throw
		set: () => {},
	})

	const origBCR = Element.prototype.getBoundingClientRect
	Element.prototype.getBoundingClientRect = function (this: Element) {
		const el = this as HTMLElement
		if (el.classList?.contains(SETTLE_CLASSES.probe)) {
			return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
		}
		if (el.classList?.contains(SETTLE_CLASSES.word)) {
			const idx = wordIndex++
			const top = Math.floor(idx / 3) * 20
			return { width: WORD_WIDTH, height: 20, top, left: 0, right: WORD_WIDTH, bottom: top + 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect
		}
		return { width: CONTAINER_WIDTH, height: 100, top: 0, left: 0, right: CONTAINER_WIDTH, bottom: 100, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
	}

	return () => {
		if (priorOffsetWidth) Object.defineProperty(proto, 'offsetWidth', priorOffsetWidth)
		Element.prototype.getBoundingClientRect = origBCR
	}
}

// ─── useSettle ────────────────────────────────────────────────────────────────

describe('useSettle', () => {
	let restore: () => void

	beforeEach(() => {
		document.body.innerHTML = ''
		wordIndex = 0
		restore = mockMeasurement()
	})

	afterEach(() => {
		restore()
		vi.restoreAllMocks()
	})

	it('mounts without throwing', () => {
		expect(() => {
			const { unmount } = renderHook(() => useSettle())
			unmount()
		}).not.toThrow()
	})

	it('returns a ref and a replay function', () => {
		const { result } = renderHook(() => useSettle())
		expect(result.current.ref).toBeDefined()
		expect(typeof result.current.replay).toBe('function')
	})

	it('unmounts without throwing', () => {
		const { unmount } = renderHook(() => useSettle({ duration: 400 }))
		expect(() => unmount()).not.toThrow()
	})

	it('re-runs when options change (no throw on option update)', () => {
		const { rerender } = renderHook(
			({ stagger }: { stagger: number }) => useSettle({ stagger }),
			{ initialProps: { stagger: 0 } },
		)
		expect(() => {
			act(() => {
				rerender({ stagger: 100 })
			})
		}).not.toThrow()
	})

	it('active:false does not throw', () => {
		expect(() => {
			const { unmount } = renderHook(() => useSettle({ active: false }))
			unmount()
		}).not.toThrow()
	})

	it('accepts all documented options without throwing', () => {
		expect(() => {
			const { unmount } = renderHook(() =>
				useSettle({
					targetTracking: 0.01,
					easing: 'linear',
					duration: 600,
					stagger: 50,
					direction: 'compress',
					lineDetection: 'bcr',
					quietReplay: true,
					intersect: false,
					active: true,
				}),
			)
			unmount()
		}).not.toThrow()
	})

	it('replay function can be called without throwing', () => {
		const { result } = renderHook(() => useSettle())
		expect(() => {
			act(() => {
				result.current.replay()
			})
		}).not.toThrow()
	})
})

// ─── SettleText ───────────────────────────────────────────────────────────────

describe('SettleText', () => {
	let restore: () => void

	beforeEach(() => {
		document.body.innerHTML = ''
		wordIndex = 0
		restore = mockMeasurement()
	})

	afterEach(() => {
		restore()
		vi.restoreAllMocks()
	})

	it('renders children without throwing', () => {
		expect(() => {
			const { unmount } = render(<SettleText>Hello world</SettleText>)
			unmount()
		}).not.toThrow()
	})

	it('renders a <p> by default', () => {
		const { container } = render(<SettleText>Hello</SettleText>)
		expect(container.querySelector('p')).toBeTruthy()
	})

	it('renders the correct element when as prop is provided', () => {
		const { container } = render(<SettleText as="h2">Hello</SettleText>)
		expect(container.querySelector('h2')).toBeTruthy()
		expect(container.querySelector('p')).toBeFalsy()
	})

	it('forwards className to the root element', () => {
		const { container } = render(
			<SettleText className="my-class">Hello</SettleText>,
		)
		const el = container.firstElementChild as HTMLElement
		expect(el.classList.contains('my-class')).toBe(true)
	})

	it('renders a span when as="span" is provided', () => {
		const { container } = render(
			<SettleText as="span">Hello</SettleText>,
		)
		expect(container.querySelector('span')).toBeTruthy()
	})

	it('renders children text content', () => {
		const { container } = render(<SettleText>Settle test</SettleText>)
		expect(container.textContent).toContain('Settle test')
	})

	it('unmounts without throwing', () => {
		const { unmount } = render(<SettleText>Hello</SettleText>)
		expect(() => unmount()).not.toThrow()
	})

	it('calls onReady with a replay function', () => {
		const onReady = vi.fn()
		render(<SettleText onReady={onReady}>Hello</SettleText>)
		expect(onReady).toHaveBeenCalledOnce()
		expect(typeof onReady.mock.calls[0][0]).toBe('function')
	})

	it('accepts all documented options without throwing', () => {
		expect(() => {
			const { unmount } = render(
				<SettleText
					targetTracking={0}
					easing="ease-in-out"
					duration={500}
					stagger={25}
					direction="expand"
					lineDetection="bcr"
					quietReplay={false}
					intersect={false}
					active={true}
				>
					All options test
				</SettleText>,
			)
			unmount()
		}).not.toThrow()
	})

	it('forwards a ref to the root DOM element', () => {
		const ref = React.createRef<HTMLElement>()
		render(<SettleText ref={ref}>Ref test</SettleText>)
		expect(ref.current).not.toBeNull()
		expect(ref.current?.tagName).toBe('P')
	})
})
