// scripts/capture.mjs — reproducible README visuals for typsettle.
//
// Serves the repo over HTTP, renders scripts/capture.html in headless Chromium,
// then produces two assets:
//   • assets/hero-settled.png — the paragraph at its settled (final) state
//   • assets/settle.gif       — the per-line settle animation, captured frame by
//                               frame and assembled with ffmpeg into a looping GIF
//
// Reproducible: re-run any time the algorithm or copy changes.
// Requires: ffmpeg on PATH, plus `npx playwright install chromium`.
// Run:      npm run build && npm run capture

import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const FRAME_DIR = join(ROOT, "assets", ".frames");
const MIME = {
	".html": "text/html",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".map": "application/json",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

// --- Static file server rooted at the repo (serves /dist, /site, /scripts) ---
const server = createServer(async (req, res) => {
	try {
		const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
		const path = join(ROOT, url === "/" ? "/scripts/capture.html" : url);
		const data = await readFile(path);
		res.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" });
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end("not found");
	}
});

await new Promise((r) => server.listen(0, r));
const { port } = server.address();
const url = `http://localhost:${port}/scripts/capture.html`;

await rm(FRAME_DIR, { recursive: true, force: true });
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch();

// --- 1. Static settled hero (deviceScaleFactor 2 → retina) ---
{
	const page = await browser.newPage({ deviceScaleFactor: 2 });
	await page.goto(url, { waitUntil: "networkidle" });
	await page.evaluate(() => window.__ready);
	await page.waitForTimeout(400);
	// Settle to equilibrium so the still shows the final state.
	await page.evaluate(() => window.__settleStill());
	await page.waitForTimeout(300);
	const card = await page.$("#card");
	await card.screenshot({ path: "assets/hero-settled.png" });
	console.log("captured assets/hero-settled.png");
	await page.close();
}

// --- 2. Animation frame sequence → GIF ---
// Capture at ~25fps across the full settle (duration 1100ms + stagger 160ms×lines
// + a head/tail pad) so the GIF loops cleanly with a beat of stillness.
{
	const FPS = 20;
	const MOTION_FRAMES = 42; // frames spanning the full settle (t: 0 → 1)
	const TAIL_FRAMES = 16;   // hold the settled state before looping

	const page = await browser.newPage({ deviceScaleFactor: 2 });
	await page.goto(url, { waitUntil: "networkidle" });
	await page.evaluate(() => window.__ready);
	await page.waitForTimeout(400);
	const card = await page.$("#card");

	// Build the real line spans, then drive the settle deterministically per frame
	// (clock-independent — see __settleFrame in capture.html). Frame 0 is the full
	// offset state; the final motion frame is equilibrium.
	const lineCount = await page.evaluate(() => window.__prepareSettle());
	console.log("settle line count: %d", lineCount);

	let frame = 0;
	for (let i = 0; i < MOTION_FRAMES; i++) {
		const t = i / (MOTION_FRAMES - 1);
		await page.evaluate((tt) => window.__settleFrame(tt), t);
		const n = String(frame).padStart(4, "0");
		await card.screenshot({ path: join(FRAME_DIR, `f${n}.png`) });
		frame++;
	}
	// Tail: hold equilibrium so the loop has a beat of stillness.
	for (let i = 0; i < TAIL_FRAMES; i++) {
		const n = String(frame).padStart(4, "0");
		await card.screenshot({ path: join(FRAME_DIR, `f${n}.png`) });
		frame++;
	}
	console.log("captured %d animation frames", frame);
	await page.close();

	// Assemble GIF with ffmpeg (palettegen for clean colour on dark bg).
	const palette = join(FRAME_DIR, "palette.png");
	const vf = "fps=" + FPS + ",scale=660:-1:flags=lanczos";
	const gen = spawnSync("ffmpeg", [
		"-y", "-i", join(FRAME_DIR, "f%04d.png"),
		"-vf", vf + ",palettegen=stats_mode=full",
		"-frames:v", "1", "-update", "1",
		palette,
	], { stdio: "inherit" });
	if (gen.status !== 0) throw new Error("ffmpeg palettegen failed");
	const out = spawnSync("ffmpeg", [
		"-y", "-i", join(FRAME_DIR, "f%04d.png"), "-i", palette,
		"-lavfi", vf + " [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=3",
		"-loop", "0",
		"assets/settle.gif",
	], { stdio: "inherit" });
	if (out.status !== 0) throw new Error("ffmpeg gif assembly failed");
	console.log("assembled assets/settle.gif");
}

await browser.close();
server.close();
await rm(FRAME_DIR, { recursive: true, force: true });
console.log("done");
