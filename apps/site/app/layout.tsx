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

export const metadata: Metadata = {
  title: { default: "Slop Meter", template: "%s · Slop Meter" },
  description:
    "Marks each paragraph human-ish, machine-ish or mixed, with the odds. The model runs in your browser.",
}

export const viewport: Viewport = {
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
