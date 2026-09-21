# Changelog

## 1.0.1, 2026-09-21

Both models retrained on a bigger corpus: 204,532 paragraphs, up from 107,319. The comparisons below put the old and new weights on the same new test set, which is harder than the old one because it has text from frontier models in it.

- The new machine text is 22,876 documents from 31 current models, GPT-5.6, Claude Sonnet 5, Grok 4.7 and Kimi K2.6 among them, in more genres and phrasings. Some were told to write like a person, using the advice in human-writing guides, and some rewrote their own first draft to sound human.
- Human text grew to match: more Reddit, Yelp, Wikipedia and web pages, 63,733 training paragraphs in place of 29,979. Without it the models got quicker to accuse people.
- Sharper reading is now three networks merged into one. It trains eight, keeps the three that catch the most current-model text on validation data, and averages them. Its weights are 256 KB where they were 58 KB, and nothing else about it changed.
- Sharper reading catches 24% of text from current models, up from 18%, and 13% of text written to dodge detection, up from 7%. It calls 0.38% of human web pages machine-ish, down from 0.56%.
- Standard catches 15% of text from current models, up from 13%, and 9% of text written to dodge detection, up from 4%. It calls 0.31% of human web pages machine-ish, down from 0.38%, and gives an answer on 12% of paragraphs where it gave one on 8%.
- Text a model polished is now labelled by how much of the person's wording survives. Under 20% of word pairs kept counts as machine, 80% or more as human, and the rest stays mixed. Before, all of it counted as mixed, so a correct call on a full rewrite was scored as a mistake.
- The bar for machine-ish never goes below 0.97.
- Sharper reading lost some ground on text from older models such as GPT-2 and Llama 2. It catches 28% of it, down from 31%.
- Three things were tried and dropped because they didn't help: a second language model beside SmolLM2, a wider network, and 22 more numbers from SmolLM2's word-by-word readings.

## 1.0.0, 2026-09-20

The first release: a Chrome extension and slop-meter.com, both reading on your device.

- Each paragraph gets one of four answers: human-ish, machine-ish, mixed or can't tell. The model has 54,243 weights stored in 8 bits, 56 KB in all, and reads 176 numbers per paragraph. Its odds are calibrated for each answer, each answer has its own bar, and the bars are set so it almost never calls a person a machine.
- On 11,948 held-out paragraphs it says can't tell on 91% and is right on 98% of the rest. It calls 0.10% of human paragraphs machine-ish.
- On 24,000 paragraphs from 2019 web pages, on sites kept out of training, it calls 0.38% machine-ish. People wrote all of them.
- Sharper reading is off until you turn it on. A small language model, SmolLM2-135M in 4 bits, reads each paragraph on your device, and a model trained with its numbers makes the call. It says can't tell on 78% of held-out paragraphs and is right on 98% of its calls. On the web check it calls 14% of the human paragraphs human-ish and 0.57% machine-ish. The language model downloads once: about 120 MB in the extension, about 125 MB on the site.
- The rulebook has 38 tells, each with an example and the fix. The model measures 36 of them.
- Human text polished by a model is the hard case: its top guess is human 48% of the time, machine-ish 31% and mixed 21%.
- The extension marks each paragraph and opens a card with the rules behind a mark. Select any text and choose Score with Slop Meter, or paste text into the popup. It works from the keyboard, shows the page's spread in its popup, has per-site switches, and stays off on mail, documents and banking.
- The site reads documents too. Drop a PDF, Word file, slide deck, spreadsheet or ebook onto the text box and it is converted to text in the tab, by WebAssembly, and scored like anything you paste.
- Rewrite and shared corrections are both opt-in. Rewrite sends the paragraph's text, and corrections send numbers only.
- The models page puts the two side by side and shows every number above, with sample sizes. On the home page the reading panel shrinks into a header that stays at the top while you scroll a long text.
- A blog, starting with the launch post, and this changelog as a page of its own.
