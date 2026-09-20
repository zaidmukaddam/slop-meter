import manifest from "@slop/model/manifest.json"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import type { Metadata, Viewport } from "next"
import { Archivo, Martian_Mono, Source_Serif_4 } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import "./globals.css"

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
})
const martian = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian",
  axes: ["wdth"],
})
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  axes: ["opsz"],
})

const DESCRIPTION =
  "Marks each paragraph human-ish, machine-ish or mixed, with the odds. The model runs in your browser."

export const metadata: Metadata = {
  metadataBase: new URL("https://slop-meter.com"),
  title: { default: "Slop Meter", template: "%s · Slop Meter" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Slop Meter",
    url: "/",
    title: "Slop Meter",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Slop Meter",
    description: DESCRIPTION,
  },
}

export const viewport: Viewport = {
  // cover: the page paints to the edges and pads itself with env(safe-area-inset-*),
  // which is 0 without it. resizes-content: the keyboard shrinks the layout on Android
  // the way it does on iOS, so the pinned reading header stays above it.
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e6e1" },
    { media: "(prefers-color-scheme: dark)", color: "#0f100e" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const fonts = `${archivo.variable} ${martian.variable} ${sourceSerif.variable}`
  return (
    <html lang="en" className={fonts}>
      <body className="flex min-h-svh flex-col">
        <NuqsAdapter>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter modelVersion={manifest.version} />
        </NuqsAdapter>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
