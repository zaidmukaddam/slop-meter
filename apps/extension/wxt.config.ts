import { fileURLToPath } from "node:url"
import { ORT_FILES } from "@slop/lm/runtime-files"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
const API = (
  process.env.WXT_API_BASE ||
  (vercel ? `https://${vercel}` : "http://localhost:3000")
).replace(/\/$/, "")

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    plugins: [
      tailwindcss(),
      {
        name: "drop-duplicate-ort-wasm",
        generateBundle(_, bundle) {
          for (const file of Object.keys(bundle)) {
            if (/ort-wasm.*\.wasm$/.test(file)) delete bundle[file]
          }
        },
      },
    ],
    define: { "import.meta.env.WXT_API_BASE": JSON.stringify(API) },
  }),
  imports: false,
  zip: { artifactTemplate: "slop-meter-{{browser}}.zip" },
  manifest: {
    name: "Slop Meter",
    description:
      "Marks each paragraph human-ish, machine-ish or mixed, with the odds. Scoring runs on your device.",
    permissions: ["storage", "offscreen", "contextMenus"],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    host_permissions: [`${new URL(API).origin}/*`],
    web_accessible_resources: [
      {
        resources: ["model.bin", "model-lm.bin", "model-lm.json"],
        matches: ["http://*/*", "https://*/*"],
      },
    ],
  },
  hooks: {
    "zip:start": () => {
      if (/\/\/(localhost|127\.0\.0\.1)/.test(API)) {
        throw new Error(
          `a store zip would call ${API}: set WXT_API_BASE=https://slop-meter.com`
        )
      }
    },
    "build:publicAssets": (_wxt, files) => {
      const copy = (specifier: string, relativeDest: string) =>
        files.push({
          absoluteSrc: fileURLToPath(import.meta.resolve(specifier)),
          relativeDest,
        })
      copy("@slop/model/model.bin", "model.bin")
      copy("@slop/model/lm/model.bin", "model-lm.bin")
      copy("@slop/model/lm/manifest.json", "model-lm.json")
      files.push(
        { absoluteSrc: ORT_FILES.mjs, relativeDest: "ort/runtime.mjs" },
        { absoluteSrc: ORT_FILES.wasm, relativeDest: "ort/runtime.wasm" }
      )
    },
  },
})
