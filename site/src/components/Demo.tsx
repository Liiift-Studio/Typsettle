"use client"

import { useState, useDeferredValue, useCallback } from "react"
import { SettleText } from "@liiift-studio/typsettle"

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

/** Before/after toggle — left half = without effect, right half filled = with effect */
function BeforeAfterToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
	return (
		<button
			onClick={onClick}
			aria-label="Toggle before/after comparison"
			title={active ? 'Hide comparison' : 'Compare without effect'}
			style={{
				position: 'absolute', bottom: 0, right: 0,
				width: 32, height: 32, borderRadius: '50%',
				border: '1px solid currentColor',
				opacity: active ? 0.8 : 0.25,
				background: 'transparent',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				cursor: 'pointer', transition: 'opacity 0.15s ease',
			}}
		>
			<svg width="14" height="10" viewBox="0 0 14 10" fill="none">
				<rect x="0.5" y="0.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
				<line x1="7" y1="0.5" x2="7" y2="9.5" stroke="currentColor" strokeWidth="1"/>
				<rect x="8" y="1.5" width="5" height="7" fill="currentColor"/>
			</svg>
		</button>
	)
}

const EASING_OPTIONS = [
	{ label: 'ease', value: 'ease' },
	{ label: 'ease-out', value: 'ease-out' },
	{ label: 'ease-in-out', value: 'ease-in-out' },
	{ label: 'linear', value: 'linear' },
] as const

type EasingOption = typeof EASING_OPTIONS[number]['value']

export default function Demo() {
	const [spread, setSpread] = useState(0.04)
	const [duration, setDuration] = useState(800)
	const [stagger, setStagger] = useState(80)
	const [easing, setEasing] = useState<EasingOption>('ease')
	const [key, setKey] = useState(0)
	const [beforeAfter, setComparing] = useState(false)

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
			<div className="flex flex-wrap items-center gap-3 mb-4">
				<span className="text-xs uppercase tracking-widest opacity-50">Easing</span>
				{EASING_OPTIONS.map(({ label, value }) => (
					<button key={value} onClick={() => { setEasing(value); replay() }} className="text-xs px-3 py-1 rounded-full border transition-opacity" style={{ borderColor: 'currentColor', opacity: easing === value ? 1 : 0.5, background: easing === value ? 'var(--btn-bg)' : 'transparent' }}>{label}</button>
				))}
			</div>
			<div className="flex items-center gap-4 mb-8">
				<button
					onClick={replay}
					className="text-xs px-4 py-1.5 rounded-full border transition-opacity hover:opacity-100"
					style={{ borderColor: 'currentColor', opacity: 0.7, background: 'var(--btn-bg)' }}
				>
					↺ Play again
				</button>
			</div>
			<div className="relative pb-8">
				<div className="flex flex-col gap-8">
					{PARAGRAPHS.map((para, i) => (
						<SettleText key={`${key}-${i}`} spread={dSpread} duration={dDuration} stagger={dStagger} easing={easing} style={sampleStyle}>
							{para}
						</SettleText>
					))}
				</div>
				{beforeAfter && (
					<div aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: '100%', opacity: 0.25, pointerEvents: 'none' }} className="flex flex-col gap-8">
						{PARAGRAPHS.map((para, i) => (
							<p key={i} style={{ ...sampleStyle, margin: 0 }}>{para}</p>
						))}
					</div>
				)}
				<BeforeAfterToggle active={beforeAfter} onClick={() => setComparing(v => !v)} />
			</div>
			<p className="text-xs opacity-50 italic mt-8" style={{ lineHeight: "1.8" }}>Text enters from randomised tracking and settles to equilibrium. Each line is staggered by {stagger}ms.</p>
		</div>
	)
}
