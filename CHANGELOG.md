# Changelog

## 1.0.1, 2026-09-23

Both models are retrained on more text, and they call fewer people machines on the open web.

- It learned from 148,291 paragraphs: 71,985 by people and 68,288 by models, from 37 current models. A new round of text from Grok, generated through xAI, is capped so one lab's models can't crowd out the rest. More web pages from sites kept out of the check went into training.
- The bars are searched in steps of 0.001 above 0.95, where they used to move in steps of 0.01. The bar for machine-ish is now 0.972.
- On 29,221 held-out paragraphs it says can't tell on 90% and is right on 97.7% of the rest. It catches 15% of text from current models and calls 0.17% of human paragraphs machine-ish.
- On the 24,000 paragraphs from web pages it calls 0.26% machine-ish, down from 0.31%.
- Sharper reading says can't tell on 75% of held-out paragraphs, is right on 97.3% of its calls and catches 24% of text from current models. On the web check it calls 0.24% machine-ish, down from 0.38%.
- The site has an audit page that counts the tells of a vibe-coded site on any page, with a JSON API, and new terms, not-found and error pages.
- The model is on npm as slop-meter-cli, a library and a command line tool that reads files or standard input.

## 1.0.0, 2026-09-20

The first release: a Chrome extension and slop-meter.com, both reading on your device.

- Each paragraph gets one of four answers: human-ish, machine-ish, mixed or can't tell. The model has 54,243 weights stored in 8 bits, 56 KB in all, and reads 176 numbers per paragraph. Its odds are calibrated for each answer, each answer has its own bar, and the bars are set so it almost never calls a person a machine. The bar for machine-ish never goes below 0.97.
- It learned from 134,054 paragraphs: 63,733 by people, from Reddit, Yelp, Wikipedia, books, news and web pages, and 62,855 by models. The corpus includes 36,874 documents generated for it by 31 current models, GPT-5.6, Claude Sonnet 5, Grok 4.7 and Kimi K2.6 among them. Some were told to write like a person, using the advice in human-writing guides, and some rewrote their own first draft to sound human.
- On 26,397 held-out paragraphs it says can't tell on 87% and is right on 97.4% of the rest. It catches 15% of text from current models and calls 0.13% of human paragraphs machine-ish.
- On 24,000 paragraphs from 2019 web pages, on sites kept out of training, it calls 0.31% machine-ish. People wrote all of them.
- Sharper reading is off until you turn it on. A small language model, SmolLM2-135M in 4 bits, reads each paragraph on your device, and three networks trained with its numbers make the call together. Eight are trained, the three that catch the most current-model text on validation data are kept, and they are merged into one, 256 KB in all. It says can't tell on 76% of held-out paragraphs, is right on 97.4% of its calls and catches 25% of text from current models. On the web check it calls 19% of the human paragraphs human-ish and 0.38% machine-ish. The language model downloads once: about 120 MB in the extension, about 125 MB on the site.
- The rulebook has 38 tells, each with an example and the fix. The model measures 36 of them.
- Text a model polished is labelled by how much of the person's wording survives. Under 20% of word pairs kept counts as machine, 80% or more as human, and the rest as mixed.
- The extension marks each paragraph and opens a card with the rules behind a mark. Select any text and choose Score with Slop Meter, or paste text into the popup. It works from the keyboard, shows the page's spread in its popup, has per-site switches, and stays off on mail, documents and banking.
- The site reads documents too. Drop a PDF, Word file, slide deck, spreadsheet or ebook onto the text box and it is converted to text in the tab, by WebAssembly, and scored like anything you paste.
- Rewrite and shared corrections are both opt-in. Rewrite sends the paragraph's text, and corrections send numbers only.
- The models page introduces the two models, puts them side by side and benchmarks both against a hosted AI judge, with sample sizes. On the home page the reading panel shrinks into a header that stays at the top while you scroll a long text.
- A blog, starting with the launch post, and this changelog as a page of its own.
