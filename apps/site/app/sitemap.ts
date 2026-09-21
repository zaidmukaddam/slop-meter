import report from "@slop/eval/report.json"
import type { MetadataRoute } from "next"
import { POSTS } from "@/lib/posts"

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
      url: `${SITE}/models`,
      lastModified: dated,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE}/rules`,
      lastModified: dated,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE}/blog`,
      lastModified: new Date(POSTS[0].date),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...POSTS.map((post) => ({
      url: `${SITE}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    {
      url: `${SITE}/changelog`,
      lastModified: dated,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE}/privacy`,
      lastModified: new Date("2026-09-22"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ]
}
