import { meta as introducing } from "./introducing-slop-meter"

/** Newest first. A post is a module here plus a page under app/blog/<slug>. */
export const POSTS = [introducing]

export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
