// OG image for typsettle.com — generated at build time via next/og
// Satori (used by ImageResponse) supports TTF and WOFF but not WOFF2.
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Typsettle — Page-load text animation to optical equilibrium'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Module-level cache — avoids repeated fs I/O on warm edge invocations */
let _interLight: Buffer | null = null
async function getInterLight(): Promise<Buffer> {
	if (!_interLight) _interLight = await readFile(join(process.cwd(), 'public/fonts/inter-300.woff'))
	return _interLight
}

export default async function Image() {
	const interLight = await getInterLight()
	return new ImageResponse(
		(
			<div style={{ background: '#081400', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', fontFamily: 'Inter, sans-serif' }}>
				{/* Label */}
				<span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#b4baa9', textTransform: 'uppercase' }}>typsettle</span>

				{/* Settling lines preview + headline */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 48 }}>
						{[0.28, 0.2, 0.13, 0.08, 0.04].map((spacing, i) => (
							<div key={i} style={{ display: 'flex', gap: `${spacing * 40}px`, alignItems: 'center' }}>
								<div style={{ width: 500, height: 3, background: i < 2 ? '#2c2f28' : '#b4baa9', borderRadius: 2 }} />
							</div>
						))}
					</div>
					<div style={{ fontSize: 76, color: '#f4f6f0', lineHeight: 1.06, fontWeight: 300 }}>Settle,</div>
					<div style={{ fontSize: 76, color: '#8f9587', lineHeight: 1.06, fontWeight: 300, fontStyle: 'italic' }}>into place.</div>
				</div>

				{/* Footer */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<div style={{ fontSize: 14, color: '#b4baa9', letterSpacing: '0.04em', display: 'flex', gap: 20 }}>
						<span>TypeScript</span>
						<span style={{ opacity: 0.4 }}>·</span>
						<span>Zero dependencies</span>
						<span style={{ opacity: 0.4 }}>·</span>
						<span>React + Vanilla JS</span>
					</div>
					<div style={{ fontSize: 13, color: '#8f9587', letterSpacing: '0.04em' }}>typsettle.com</div>
				</div>
			</div>
		),
		{ ...size, fonts: [{ name: 'Inter', data: interLight, style: 'normal', weight: 300 }] },
	)
}
