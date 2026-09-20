# Slop Meter

A Chrome extension and a site that mark, paragraph by paragraph, how machine-shaped a piece of text is and how sure the meter is. A 54K-parameter model runs in the browser (WebGPU, with a CPU fallback) and never sends text anywhere. Four outcomes: human-ish, machine-ish, mixed, can't tell.

## Layout

| Path | What |
|---|---|
| `packages/rules` | `rulebook.yaml` (38 rules, stable ids, each with an example), validator, `rules.json`, learned `weights.json`, rewrite instructions |
| `packages/features` | Rule extractors (one function per rule id, with spans) and the stylometry block. 176 floats per paragraph, frozen spec |
| `packages/model` | Runtime: int8 weights, TS forward pass, WGSL batch kernel, attribution, and the words every surface uses for an answer (labels, card note, the correction record). One scorer holds the base model and, while sharper reading is on, the sharper one (`weights/lm/`); each score carries the model that made it |
| `packages/lm` | Sharper reading's eight language-model features: SmolLM2-135M (ONNX, 4-bit, WebGPU) through transformers.js, one batched forward pass per group of paragraphs. `spec` and `device` load without transformers.js. Training and both browsers run this code |
| `packages/theme` | The palette (`light-dark()` tokens), the Tailwind mapping, the answer colors for page marks, and the logo, shared by the site, the popup and the hover card |
| `apps/extension` | WXT MV3 extension. Content script is vanilla TS (gutter marks, Shadow DOM hover card, highlights, "Score with Slop Meter" on a selection); popup is React with shadcn/ui on Base UI, with a box to score pasted text; an offscreen page runs the language model while sharper reading is on |
| `apps/site` | Next.js 16 + shadcn/ui (Base UI, `base-mira`): try-it demo with hover cards, try-to-fool-it playground, rulebook, calibration, device benchmark, install. API routes for rewrite, feedback, nightly calibration |
| `training/` | Corpus prep (RAID, pre-2022 web, WildChat, Magpie, gateway generations), featurizer, PyTorch trainer and int8 export |
| `eval/` | 200-paragraph labeled set, `report.json` (held-out metrics), the Jev benchmark, demo examples |

## Run it

```bash
pnpm install
pnpm check          # rulebook, format, types, tests, TS/WGSL parity, extension build + size gate, site build
pnpm --filter @slop/site dev
pnpm --filter @slop/extension e2e   # real Chromium: marks, card, popup, fallback, scroll jank
```

`.env.local` at the repo root holds `AI_GATEWAY_API_KEY` (rewrite, corpus generation, the Jev benchmark). Optional for the site: `DATABASE_URL` (feedback, budgets, calibration snapshots), `CRON_SECRET`, `REWRITE_MODEL` (default `openai/gpt-4.1-mini`).

## Retrain

```bash
cd training
uv venv -p 3.12 .venv && uv pip install --python .venv/bin/python torch numpy pyarrow pandas
# download RAID train parquet shards to data/raid, Reddit/Yelp/Wikipedia shards to data/human,
# one WildChat-1M and one Magpie-Llama-3.1 shard to data/public, and C4's
# en/c4-validation.00000-of-00008.json.gz to data/web (see prepare.py)
.venv/bin/python prepare.py                           # also writes data/seeds.jsonl
node --env-file=../.env.local generate.ts 2600        # optional: text for a slice of the seeds, cheap models only
.venv/bin/python prepare.py && node featurize.ts && .venv/bin/python train.py
node featurize-lm.ts && .venv/bin/python train.py --lm   # the sharper model; about an hour on an M4 Pro
```

`train.py` writes the weights, the manifest, per-rule weights and `eval/report.json`; with `--lm`, `weights/lm/` and `eval/report-lm.json`. `--seeds N` (default 5) trains N runs and ships the one that calls the fewest human paragraphs machine-ish on validation. `--ablate r-028` zeroes a feature and writes `eval/ablation-r-028.json` without shipping anything. With `--feedback data/feedback.jsonl` it adds opt-in user corrections (vectors and labels only) and refuses to ship unless ECE on the newest feedback drops without raising the false-machine rate on human text.

## Where the numbers are

- `eval/report.json`: held-out test and adversarial metrics, baseline vs model, reliability per class, accuracy vs unsure-rate curve, per-source breakdown, the ship criteria (`m2Exit`), and the web check (`decision.web`: 3,000 human paragraphs from 2019 pages on sites kept out of training).
- `eval/report-lm.json`: the same report for the sharper model.
- The site's `/calibration` page renders both, dated, with sample sizes.

## Known limits

- Labels come from provenance, not annotators. "Mixed" means model-polished human text or human/model splices; human edits of model text are not in the corpus.
- It says can't tell on most paragraphs: about 9 in 10 on held-out text and 98 in 100 on the web check, at bars set for 96% right on calls. The calibration page shows what lower bars would cost. Sharper reading (opt-in) brings held-out can't tell to about 77 in 100.
- Sharper reading needs WebGPU with 16-bit floats. The extension package carries onnxruntime's 27 MB WebAssembly, because MV3 bars code from the network; the model itself downloads on opt-in (about 120 MB; about 125 MB on the site, which also fetches the runtime, compressed). While it runs it adds about 800 MB to the tab, mostly onnxruntime's WebAssembly memory.
- Marks go on elements, so text split into paragraphs only by line breaks inside one element (older hand-written sites) gets none. Selecting it and choosing Score with Slop Meter still works. Pages without `<main>` or `<article>` are read from the smallest element that holds all their prose, which on a comment thread is the whole thread.
- Current models (GPT-5.6 Luna, DeepSeek V4.1) mostly get can't tell from the standard model. On their short social posts and replies it leans machine; on their long essays and blog posts it leans human about as often as machine. Both are in the training data, so more of the same data doesn't move this.
- Human web prose comes from one C4 shard (3,000 pages from 2019). Formal human prose is still hard; the Federal Reserve example on the site leans machine-ish.
- RAID's parquet mirror covers 4 of its 8 domains (abstracts, books, news, poetry); Reddit, Yelp and Wikipedia fill the web side.
- Weakest on model-polished human text, whose top guess is human 42% of the time, and on paraphrased machine text, which is a coin flip. The calibration page shows all of it.
- English only.
