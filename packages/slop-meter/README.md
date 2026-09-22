# slop-meter

Marks each paragraph **human-ish**, **machine-ish**, **mixed** or **can't tell**, with calibrated odds. It's the model behind [slop-meter.com](https://slop-meter.com) and the Chrome extension: 56 KB of weights that run locally, with no network calls and no API key.

It says can't tell on most paragraphs. That is on purpose: it only makes a call when it is sure, and it calls about 1 human paragraph in 1,000 machine-ish. Treat a mark as a guess about style. It can't tell you who wrote something.

## CLI

```bash
npx slop-meter post.md
cat draft.txt | npx slop-meter
```

```
post.md
  ¶1  machine-ish  99%  In today's fast-paced digital landscape, it's important to note…
  ¶2  can't tell        I rebuilt the bench vise last week. It took two evenings and…
  2 read · 1 machine-ish · 0 human-ish · 0 mixed · 1 can't tell
```

| Option | Effect |
|---|---|
| `--json` | Print every paragraph as JSON |
| `--why` | List the rules behind each call |
| `--fail` | Exit with code 1 if any paragraph is machine-ish, for CI |

Markdown headings, code blocks and HTML comments are skipped. Paragraphs under 25 words, or not in English, are counted but not scored.

## Library

```js
import { score, scoreText } from "slop-meter"

const reading = await score("In today's fast-paced digital landscape…")
reading.verdict // "machine"
reading.label // "machine-ish"
reading.confidence // 0.99
reading.reasons // [{ id: "r-006", name: "abstract metaphor nouns", spans: [[25, 34]] }]

const readings = await scoreText(longText) // one reading per paragraph
```

A reading has `text`, `words`, `verdict` (`human`, `machine`, `mixed` or `unsure`), `label`, `confidence`, `probabilities`, `reasons` and `skipped` (`too-short`, `not-english` or `null`). Each reason's `spans` are character ranges of the words that set it off.

It works in Node 20+ and in the browser. The [models page](https://slop-meter.com/models) has every number, and the [rulebook](https://slop-meter.com/rules) explains each reason.

## License

AGPL-3.0. Source: [github.com/zaidmukaddam/slop-meter](https://github.com/zaidmukaddam/slop-meter).
