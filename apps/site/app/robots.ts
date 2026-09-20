import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://slop-meter.com/sitemap.xml",
    host: "https://slop-meter.com",
  }
}
