# Changelog

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
- The models page puts the two side by side and shows every number above, with sample sizes. The reading panel collapses into a pinned header as you scroll, so the gauge stays with you down a long text.
- A blog, starting with the launch post, and this changelog as a page of its own.
