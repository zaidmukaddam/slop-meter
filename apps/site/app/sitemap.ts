import report from "@slop/eval/report.json"
import type { MetadataRoute } from "next"

const SITE = "https://slop-meter.com"
const dated = new Date(report.date)

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE, lastModified: dated, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE}/install`,
      lastModified: dated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/rules`,
      lastModified: dated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/calibration`,
      lastModified: dated,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ]
}
