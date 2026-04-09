// settle/src/react/SettleText.tsx — React component wrapper
import React, { forwardRef, useCallback } from 'react'
import { useSettle } from './useSettle'
import type { SettleOptions } from '../core/types'

interface SettleTextProps extends SettleOptions {
	children: React.ReactNode
	className?: string
	style?: React.CSSProperties
	as?: React.ElementType
}

/**
 * Drop-in component that applies the settle effect to its children.
 * Forwards the ref to the root DOM element while also wiring the internal settle ref.
 */
export const SettleText = forwardRef<HTMLElement, SettleTextProps>(
	function SettleText({ children, className, style, as: Tag = 'p', ...options }, forwardedRef) {
		const innerRef = useSettle(options)

		/** Merged ref callback — satisfies both the internal hook ref and any forwarded ref. */
		const mergedRef = useCallback(
			(node: HTMLElement | null) => {
				// Write to the inner mutable ref used by useSettle
				;(innerRef as React.MutableRefObject<HTMLElement | null>).current = node
				// Forward to the caller's ref (callback or object)
				if (typeof forwardedRef === 'function') {
					forwardedRef(node)
				} else if (forwardedRef) {
					forwardedRef.current = node
				}
			},
			// eslint-disable-next-line react-hooks/exhaustive-deps
			[innerRef, forwardedRef],
		)

		return (
			<Tag ref={mergedRef as React.Ref<HTMLElement>} className={className} style={style}>
				{children}
			</Tag>
		)
	},
)

SettleText.displayName = 'SettleText'
