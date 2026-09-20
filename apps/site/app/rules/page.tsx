import { RULES } from "@slop/rules"
import weights from "@slop/rules/weights.json"
import type { Metadata } from "next"
import { PageIntro } from "@/components/page-intro"
import { Rulebook } from "@/components/rules/rulebook"

const measured = Object.keys(weights.rules).length

export const metadata: Metadata = {
  title: "Rulebook",
  description: `The ${RULES.length} tells Slop Meter looks for, which way each one points, and how often it shows up in human and machine writing.`,
}

export default function RulesPage() {
  return (
    <>
      <PageIntro
        label="Rulebook"
        title={`${RULES.length} tells, and which way each one points`}
      >
        <p>
          Each rule is a habit that model writing and people's writing show at
          different rates. Most point toward a model, a few point the other way,
          and none decides anything alone. The meter weighs the {measured} it
          can measure together with 140 measures of rhythm and word choice,
          using weights learned from data.
        </p>
      </PageIntro>
      <Rulebook />
    </>
  )
}
