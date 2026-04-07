// settle/src/react/SettleText.tsx — React component wrapper
import React, { forwardRef } from 'react'
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
 */
export const SettleText = forwardRef<HTMLElement, SettleTextProps>(
	function SettleText({ children, className, style, as: Tag = 'p', ...options }, _ref) {
		const innerRef = useSettle(options)
		return (
			<Tag ref={innerRef as React.Ref<HTMLElement>} className={className} style={style}>
				{children}
			</Tag>
		)
	},
)

SettleText.displayName = 'SettleText'
