"use client"

import { useState, useDeferredValue, useCallback } from "react"
import { SettleText } from "@liiift-studio/settle"

const PARAGRAPHS = [
	`The first thing a reader notices about a text is not the words but the colour — the even grey field of the paragraph taken as a whole. Before meaning, before syntax, there is that impression: light, dark, dense, airy. The typographer works to make it even, to give the reader a surface to move across without resistance. A page-load animation that begins in chaos and resolves into order says something about the text it introduces: that it knows where it is going.`,
	`Tracking — the spacing between letters across a whole word or line — is the most delicate of the compositor's instruments. Too tight and letters close against each other; too loose and words fragment. The right amount is invisible.`,
]

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs uppercase tracking-widest opacity-50">{label}</span>
			<input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={e => onChange(Number(e.target.value))} onTouchStart={e => e.stopPropagation()} style={{ touchAction: 'none' }} />
			<span className="tabular-nums text-xs opacity-50 text-right">{value}</span>
		</div>
	)
}

export default function Demo() {
	const [spread, setSpread] = useState(0.04)
	const [duration, setDuration] = useState(800)
	const [stagger, setStagger] = useState(80)
	const [key, setKey] = useState(0)

	const dSpread = useDeferredValue(spread)
	const dDuration = useDeferredValue(duration)
	const dStagger = useDeferredValue(stagger)

	const replay = useCallback(() => setKey(k => k + 1), [])

	const sampleStyle: React.CSSProperties = {
		fontFamily: "var(--font-merriweather), serif",
		fontSize: "1.125rem",
		lineHeight: "1.8",
	}

	return (
		<div className="w-full">
			<div className="grid grid-cols-3 gap-6 mb-6">
				<Slider label="Spread" value={spread} min={0.005} max={0.12} step={0.005} onChange={setSpread} />
				<Slider label="Duration (ms)" value={duration} min={200} max={2000} step={50} onChange={setDuration} />
				<Slider label="Stagger (ms)" value={stagger} min={0} max={300} step={10} onChange={setStagger} />
			</div>
			<div className="flex items-center gap-4 mb-8">
				<button
					onClick={replay}
					className="text-xs px-4 py-1.5 rounded-full border transition-opacity hover:opacity-100"
					style={{ borderColor: 'currentColor', opacity: 0.7, background: 'var(--btn-bg)' }}
				>
					↺ Play again
				</button>
				<span className="text-xs opacity-50">Reload to see the entrance animation, or press Play again.</span>
			</div>
			<div className="flex flex-col gap-5">
				{PARAGRAPHS.map((para, i) => (
					<SettleText key={`${key}-${i}`} spread={dSpread} duration={dDuration} stagger={dStagger} style={sampleStyle}>
						{para}
					</SettleText>
				))}
			</div>
			<p className="text-xs opacity-50 italic mt-6">Text enters from randomised tracking and settles to equilibrium. Each line is staggered by {stagger}ms.</p>
		</div>
	)
}
