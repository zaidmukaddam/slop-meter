import type { Metadata } from "next"
import { PageIntro } from "@/components/page-intro"

const UPDATED = "2026-09-22"
const CONTACT = "hey@zaidmukaddam.com"

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy" },
  description:
    "What Slop Meter does with your text: it is scored on your device, and it leaves only when you ask for a rewrite.",
}

const SECTIONS = [
  {
    title: "Scoring stays on your device",
    body: [
      "The extension and this site score text with a small model that runs in your browser. The pages you read, the text you paste and the documents you drop on the site are not uploaded, and no account is needed.",
      "The extension keeps your settings, your per-site switches and any corrections you make in your browser's own storage. Removing the extension deletes them.",
    ],
  },
  {
    title: "Rewrite sends one paragraph",
    body: [
      "Rewrite is off until you turn it on, and it only runs when you press it on a paragraph. That paragraph's text, and the ids of the rules it tripped, go to slop-meter.com, which passes them to a language model through Vercel's AI Gateway and streams the answer back. We do not store the text.",
      "To stop abuse we keep a daily count of rewrites against a one-way hash of your IP address. The address itself is not stored.",
    ],
  },
  {
    title: "Shared corrections send numbers, never text",
    body: [
      "Sharing corrections is off until you turn it on. When it is on and you tell the meter it got a paragraph wrong, we receive the numbers the model measured for that paragraph, what it guessed, what you said, a broad kind of site such as forum or reference, the model version, and a random id made when the extension was installed. We do not receive the text or the address of the page.",
      "We use these to retrain the model. The numbers can't be turned back into the paragraph.",
    ],
  },
  {
    title: "Sharper reading downloads a model",
    body: [
      "Turning on sharper reading downloads an open language model, SmolLM2, from Hugging Face, once. Hugging Face sees that download the way any site sees a visit. After that the model runs on your device, and your text does not go to it or to us.",
    ],
  },
  {
    title: "This site",
    body: [
      "slop-meter.com uses Vercel Web Analytics and Speed Insights to count visits and measure load times. They use no cookies and do not follow you across sites.",
    ],
  },
  {
    title: "What we don't do",
    body: [
      "We don't sell data, show ads or build profiles, and we don't use anything above for a purpose other than running and improving Slop Meter.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <>
      <PageIntro label="Privacy" title="What leaves your device">
        <p>
          Almost nothing. Text is scored in your browser. It leaves only when
          you ask for a rewrite, one paragraph at a time.
        </p>
      </PageIntro>

      <div className="border-t border-hairline">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          {SECTIONS.map((section) => (
            <section
              key={section.title}
              className="grid gap-x-16 gap-y-4 border-b border-hairline py-12 lg:grid-cols-[22rem_minmax(0,1fr)] lg:py-16"
            >
              <h2 className="text-xl font-semibold text-balance">
                {section.title}
              </h2>
              <div className="max-w-2xl space-y-4 text-[17px]/relaxed text-pretty text-graphite">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
          <p className="max-w-2xl py-10 text-sm/relaxed text-pretty text-graphite">
            Questions, or a request to delete corrections you shared:{" "}
            <a href={`mailto:${CONTACT}`} className="underline">
              {CONTACT}
            </a>
            . Last updated <time dateTime={UPDATED}>22 September 2026</time>.
          </p>
        </div>
      </div>
    </>
  )
}
