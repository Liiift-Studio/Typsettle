import type { Metadata } from "next"
import "./globals.css"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
	title: "Settle — Page-load text animation to optical equilibrium",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description:
		"Settle animates paragraph text from randomised letter-spacing to optical equilibrium on page load. A subtle entrance animation that feels typographic rather than decorative.",
	keywords: ["settle", "page load animation", "letter spacing", "typography", "TypeScript", "npm", "react animation"],
	openGraph: {
		title: "Settle — Page-load text animation to optical equilibrium",
		description: "Text enters from randomised spacing and settles into place. A typographic page-load animation.",
		url: "https://typsettle.com",
		siteName: "Settle",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Settle — Page-load text animation to optical equilibrium",
		description: "Text enters from randomised spacing and settles into place. A typographic page-load animation.",
	},
	metadataBase: new URL("https://typsettle.com"),
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`h-full antialiased ${inter.variable}`}>
			<body className="min-h-full flex flex-col">{children}</body>
		</html>
	)
}
