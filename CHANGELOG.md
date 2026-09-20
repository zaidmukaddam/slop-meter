# Changelog

## 1.0.0, 2026-09-20

The first release: a Chrome extension and slop-meter.com, both reading on your device.

- Each paragraph gets one of four answers: human-ish, machine-ish, mixed or can't tell. The model has 54,243 weights stored in 8 bits, 56 KB in all, and reads 176 numbers per paragraph. Its odds are calibrated for each answer, and each answer has its own bar.
- On 10,239 held-out paragraphs it says can't tell on 92% and is right on 97% of the rest. It calls 0.14% of human paragraphs machine-ish.
- On 3,000 paragraphs from 2019 web pages, on sites kept out of training, it calls 0.2% machine-ish. People wrote all of them.
- Sharper reading is off until you turn it on. A small language model, SmolLM2-135M in 4 bits, reads each paragraph on your device, and a model trained with its numbers makes the call. It says can't tell on 77% of held-out paragraphs and is right on 97% of its calls. On the web check it calls 15% of the human paragraphs human-ish and 0.7% machine-ish. The language model downloads once: about 120 MB in the extension, about 125 MB on the site.
- The rulebook has 38 tells, each with an example and the fix. The model measures 36 of them.
- Human text polished by a model is the hard case: its top guess is human 43% of the time, machine-ish 34% and mixed 24%.
- The extension marks each paragraph and opens a card with the rules behind a mark. Select any text and choose Score with Slop Meter, or paste text into the popup. It works from the keyboard, shows the page's spread in its popup, has per-site switches, and stays off on mail, documents and banking.
- Rewrite and shared corrections are both opt-in. Rewrite sends the paragraph's text, and corrections send numbers only.
- The calibration page shows every number above, with sample sizes.
