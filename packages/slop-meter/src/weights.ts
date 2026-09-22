import { readFileSync } from "node:fs"

export default readFileSync(
  new URL(import.meta.resolve("@slop/model/model.bin"))
)
