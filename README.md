<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/readme-dark.png">
  <img src=".github/assets/readme-light.png" alt="Slop Meter: four gauges, one for each answer it gives a paragraph: human-ish, mixed, can't tell and machine-ish." width="100%">
</picture>

# Slop Meter

Marks text paragraph by paragraph: **human-ish**, **machine-ish**, **mixed** or **can't tell**, with calibrated odds. A 56 KB model runs in the browser, on WebGPU or the CPU, and no text leaves the device. Use it on [slop-meter.com](https://slop-meter.com) or as a [Chrome extension](https://chromewebstore.google.com/detail/slop-meter/cfajcepfchcgohbgblhdcdcdoajljkbp).

[models and numbers](https://slop-meter.com/models) · [rulebook](https://slop-meter.com/rules) · [site audit](https://slop-meter.com/audit) · [blog](https://slop-meter.com/blog) · [changelog](https://slop-meter.com/changelog) · [install](https://slop-meter.com/install)

## npm package and CLI

`npx slop-meter-cli post.md` marks each paragraph from the command line, and `import { score } from "slop-meter-cli"` does it from code, in Node or the browser. The weights ship inside the package, so nothing is sent anywhere. See [packages/slop-meter](packages/slop-meter).

## Site audit API

`GET https://slop-meter.com/api/audit?url=example.com` fetches the page and its stylesheets and returns the same report as [/audit](https://slop-meter.com/audit), as JSON: `url`, `found`, `total`, `partial` (true when most of the page is drawn by JavaScript) and `findings`, each with `id`, `group`, `title`, `hit` and `evidence`. Errors come back as `{ "error": "..." }` with 400 for a bad or private address, 422 when the address isn't a web page, 429 past 30 audits a day from one IP, and 502 when the site fails to answer. No key is needed.

## Numbers

| | Standard | Sharper (opt-in) |
|---|---|---|
| Size | 56 KB | 256 KB + SmolLM2-135M, 125 MB once |
| Features per paragraph | 176 | 184 |
| Networks | 1 | 3, merged into one |
| Can't tell, held out (n=29,221) | 90% | 75% |
| Right when it calls | 97.7% | 97.3% |
| Human text called machine-ish | 0.17% | 0.16% |
| Human web pages called machine-ish (n=24,000) | 0.26% | 0.24% |
| Recent-model text caught | 15% | 24% |

Full reports are `eval/report.json` and `eval/report-lm.json`.

## Run it

```bash
pnpm install
pnpm check                          # rulebook, format, types, tests, builds, size gate
pnpm --filter @slop/site dev
pnpm --filter @slop/extension e2e   # the extension in real Chromium
WXT_API_BASE=https://slop-meter.com pnpm --filter @slop/extension zip   # the Chrome Web Store zip
```

`.env.local` at the repo root takes `AI_GATEWAY_API_KEY` (rewrite and corpus generation). `training/generate.ts` also reads `OPENAI_API_KEY`, `XAI_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` and `AMAZON_BEDROCK_API_KEY` for the models it calls through their own providers, and `--lab openai,meta` limits a run to those labs. The site also reads `DATABASE_URL`, `CRON_SECRET` and `REWRITE_MODEL`, all optional.

## Layout

| Path | What |
|---|---|
| `packages/rules` | `rulebook.yaml`: 38 tells with ids and examples |
| `packages/features` | 176 numbers per paragraph: one per rule, plus stylometry |
| `packages/model` | int8 weights, TS forward pass, WGSL kernel |
| `packages/lm` | 8 features from SmolLM2-135M, for sharper reading |
| `packages/theme` | Design tokens |
| `apps/extension` | WXT MV3 extension |
| `apps/site` | Next.js site |
| `training/` | Corpus prep, featurizer, trainer |
| `eval/` | Reports, demo examples, model comparison |

## Retrain

```bash
cd training
uv venv -p 3.12 .venv && uv pip install --python .venv/bin/python torch numpy pyarrow pandas
.venv/bin/python fetch.py            # RAID (12 GB) and C4
# Reddit, Yelp and Wikipedia go in data/human; WildChat and Magpie in data/public
.venv/bin/python prepare.py && node featurize.ts && .venv/bin/python train.py
node featurize-lm.ts && .venv/bin/python train.py --lm --seeds 8     # sharper model, about an hour the first time, minutes after
node ../eval/compare-models.ts <old-weights-dir> ../packages/model/weights
```

| Flag | Effect |
|---|---|
| `--seeds N` | Train N runs (default 5) and ship the one that catches the most current-model text |
| `--lm` | Train the sharper model: the 3 runs that catch the most current-model text on validation, merged into one network |
| `--ablate r-028` | Train without a feature, write `eval/ablation-r-028.json`, ship nothing |
| `--feedback f.jsonl` | Add opt-in corrections |

A model ships only if its calls are right 96% of the time and it calls at most 0.1% of human validation paragraphs machine-ish (0.2% for sharper). The bar for machine-ish never goes below 0.97. `featurize-lm.ts` keeps what SmolLM2 said about each paragraph and only reads new ones.

## License

[AGPL-3.0](LICENSE). The Wikipedia demo text is CC BY-SA 3.0. Every demo text's source is in `eval/examples.json`.
