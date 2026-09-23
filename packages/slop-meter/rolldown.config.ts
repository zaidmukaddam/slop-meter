import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "rolldown"

const INLINED = fileURLToPath(new URL("src/weights.ts", import.meta.url))
const weights = readFileSync(
  new URL(import.meta.resolve("@slop/model/model.bin"))
).toString("base64")

export default defineConfig({
  input: { index: "src/index.ts", cli: "src/cli.ts" },
  platform: "neutral",
  external: [/^node:/],
  plugins: [
    {
      name: "inline-weights",
      load(id) {
        if (id !== INLINED) return null
        return `export default Uint8Array.from(atob("${weights}"), (c) => c.charCodeAt(0))`
      },
    },
  ],
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "[name].js",
    banner: (chunk) => (chunk.name === "cli" ? "#!/usr/bin/env node" : ""),
  },
})
