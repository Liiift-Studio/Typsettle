import Demo from "@/components/Demo"
import CopyInstall from "@/components/CopyInstall"
import CodeBlock from "@/components/CodeBlock"
import ToolDirectory from "@/components/ToolDirectory"
import { version } from "../../../package.json"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-widest opacity-50">settle</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ fontFamily: "var(--font-merriweather), serif", lineHeight: "1.05em" }}>
						Settle,<br />
						<span style={{ opacity: 0.5, fontStyle: "italic" }}>into place.</span>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a href="https://github.com/quitequinn/settle" target="_blank" rel="noopener noreferrer" className="text-sm opacity-50 hover:opacity-100 transition-opacity">GitHub ↗</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-50 tracking-wide">
					<span>TypeScript</span><span>·</span><span>Zero dependencies</span><span>·</span><span>React + Vanilla JS</span>
				</div>
				<p className="text-base opacity-60 leading-relaxed max-w-lg">
					Paragraph text enters from randomised letter-spacing and transitions to optical equilibrium. A page-load animation that feels typographic rather than decorative — lines staggered, motion purposeful, prefers-reduced-motion respected.
				</p>
			</section>

			{/* Demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4">
				<p className="text-xs uppercase tracking-widest opacity-50">Live demo</p>
				<div className="rounded-xl -mx-8 px-8 py-8" style={{ background: "rgba(0,0,0,0.25)" }}>
					<Demo />
				</div>
			</section>

			{/* Explanation */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<p className="text-xs uppercase tracking-widest opacity-50">How it works</p>
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed opacity-70">
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">The entrance</p>
						<p>Each line of text starts with a randomised letter-spacing offset — some wider, some tighter. The offset is unique per line, creating a sense of subtle chaos that reads as typographic texture rather than noise.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold opacity-100 text-base">The resolution</p>
						<p>A CSS transition carries each line to zero extra spacing — the optically neutral baseline. The stagger control spaces these transitions apart so lines settle in sequence rather than all at once.</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-baseline gap-4">
					<p className="text-xs uppercase tracking-widest opacity-50">Usage</p>
				</div>
				<div className="flex flex-col gap-8 text-sm">
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Drop-in component</p>
						<CodeBlock code={`import { SettleText } from '@liiift-studio/typsettle'

<SettleText spread={0.04} duration={800} stagger={80}>
  Your paragraph text here...
</SettleText>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Hook</p>
						<CodeBlock code={`import { useSettle } from '@liiift-studio/typsettle'

const ref = useSettle({ spread: 0.04, duration: 800, stagger: 80 })
<p ref={ref}>{children}</p>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="opacity-50">Options</p>
						<table className="w-full text-xs">
							<thead><tr className="opacity-50 text-left"><th className="pb-2 pr-6 font-normal">Option</th><th className="pb-2 pr-6 font-normal">Default</th><th className="pb-2 font-normal">Description</th></tr></thead>
							<tbody className="opacity-70">
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">spread</td><td className="py-2 pr-6">0.04</td><td className="py-2">Max initial letter-spacing offset in em.</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">duration</td><td className="py-2 pr-6">800</td><td className="py-2">Transition duration in milliseconds.</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">easing</td><td className="py-2 pr-6">ease</td><td className="py-2">CSS easing string.</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">stagger</td><td className="py-2 pr-6">0</td><td className="py-2">Delay between lines in ms. 0 = all settle together.</td></tr>
								<tr className="border-t border-white/10 hover:bg-white/5 transition-colors"><td className="py-2 pr-6 font-mono">active</td><td className="py-2 pr-6">true</td><td className="py-2">Set false to skip animation entirely.</td></tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6 pt-8 border-t border-white/10 text-xs">
				<ToolDirectory current="typsettle" />
				<div className="flex justify-between opacity-50">
				<span>typsettle v{version}</span>
				<a href="https://liiift.studio" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">Liiift Studio</a>
				</div>
			</footer>

		</main>
	)
}
