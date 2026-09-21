import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { Scorer, explain, loadModel } from "../src/index.ts"

const read = (path: string) => readFileSync(new URL(path, import.meta.url))
const manifest = JSON.parse(read("../weights/manifest.json").toString())
const bin = read("../weights/model.bin")
const lmManifest = JSON.parse(read("../weights/lm/manifest.json").toString())
const lmBin = read("../weights/lm/model.bin")
const scorer = await Scorer.create(manifest, bin, { backend: "cpu" })
const examples = JSON.parse(read("../../../eval/examples.json").toString())
const machine = `In today's fast-paced digital landscape, remote work has emerged as a transformative force that fundamentally reshapes how teams collaborate. It's not just a trend, it's a paradigm shift. Moreover, studies show that remote teams foster innovation, boost productivity, and enhance employee well-being. By leveraging cutting-edge tools, organizations can unlock unprecedented levels of efficiency, highlighting the pivotal role of flexibility in the modern workplace.`

test("scores sum to one, decisions are one of four", () => {
  const s = scorer.score(machine)
  assert.ok(
    Math.abs(s.probs.human + s.probs.machine + s.probs.mixed - 1) < 1e-6
  )
  assert.ok(["human", "machine", "mixed", "unsure"].includes(s.localDecision))
  assert.equal(s.localP, s.probs[s.top])
  assert.equal(s.bar, s.top === "machine" ? manifest.tauMachine : manifest.tau)
})

test("a paragraph dense with tells reads as machine-ish, and explain names rules that fired", () => {
  const s = scorer.score(machine)
  assert.equal(s.top, "machine")
  assert.ok(s.probs.machine > 0.9, `machine ${s.probs.machine}`)
  const why = explain(s)
  assert.equal(why.length, 3)
  for (const r of why) assert.ok(r.value > 0.05 && r.push > 0 && r.name)
})

test("the sharper model scores paragraphs that come with language-model features, while attached", () => {
  const n = lmManifest.lm.features.length
  const lm = new Float32Array(n)
  const text = `${machine} Once more.`
  const version = (s: { model: { manifest: { version: string } } }) =>
    s.model.manifest.version

  assert.equal(version(scorer.score(text, lm)), manifest.version)
  scorer.useLm(lmManifest, lmBin)
  const s = scorer.score(text, lm)
  assert.equal(version(s), lmManifest.version)
  assert.equal(s.lm, lm)
  assert.equal(s.vector.length, lmManifest.features.length - n)
  assert.ok(explain(s).every((r) => r.id.startsWith("r-")))
  assert.equal(version(scorer.score(text)), manifest.version)
  scorer.dropLm()
  assert.equal(version(scorer.score(text, lm)), manifest.version)
})

test("a batch scores the same as one at a time", async () => {
  const fresh = await Scorer.create(manifest, bin, { backend: "cpu" })
  const paragraphs = examples.flatMap((e: { text: string }) =>
    e.text.split("\n\n")
  )
  const batch = await fresh.scoreBatch(paragraphs)
  paragraphs.forEach((p: string, i: number) =>
    assert.deepEqual(batch[i].probs, scorer.score(p).probs)
  )
})

test("Thoreau is not called machine", () => {
  const thoreau = examples
    .find((e: { id: string }) => e.id === "human-essay")
    .text.split("\n\n")
  for (const p of thoreau)
    assert.notEqual(scorer.score(p).localDecision, "machine")
})

test('short paragraphs are "unsure", not guessed', () => {
  const s = scorer.score("Great post, thanks.")
  assert.equal(s.tooShort, true)
  assert.equal(s.localDecision, "unsure")
})

test('text that is not English is "unsure", not guessed', () => {
  const french =
    "Les modeles de langue produisent des textes qui ressemblent beaucoup a " +
    "ceux des gens, et la difference tient souvent a des details minuscules. " +
    "Cette page ne sait pas lire le francais, elle ne devrait donc rien " +
    "affirmer du tout sur ce paragraphe assez long pour etre lu autrement."
  const score = scorer.score(french)
  assert.equal(score.tooShort, false)
  assert.equal(score.notEnglish, true)
  assert.equal(score.localDecision, "unsure")
  assert.equal(scorer.score(machine).notEnglish, false)
})

test("cache returns the same object for the same paragraph", () => {
  assert.equal(scorer.score(machine), scorer.score(machine))
})

test("weights refuse to load against anything but the inputs they were trained on", () => {
  assert.throws(
    () => loadModel({ ...manifest, spec: manifest.spec + 1 }, bin),
    /feature spec/
  )
  assert.throws(
    () => loadModel({ ...manifest, features: manifest.features.slice(1) }, bin),
    /feature spec/
  )
  assert.throws(
    () =>
      loadModel({ ...manifest, classes: ["machine", "human", "mixed"] }, bin),
    /class order/
  )
  assert.throws(
    () =>
      loadModel(
        { ...lmManifest, lm: { ...lmManifest.lm, dtype: "q4" } },
        lmBin
      ),
    /language-model features/
  )
})
