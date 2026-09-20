import { existsSync } from "node:fs"
import { join } from "node:path"
import type { NextConfig } from "next"

const repoRoot = join(process.cwd(), "../..")

const rootEnv = join(repoRoot, ".env.local")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [
    "100.91.51.106",
    "zaids-macbook-pro.jaguar-gopher.ts.net",
  ],
  outputFileTracingRoot: repoRoot,
  transpilePackages: [
    "@slop/rules",
    "@slop/features",
    "@slop/lm",
    "@slop/model",
    "@slop/theme",
    "@slop/eval",
  ],
}

export default nextConfig
