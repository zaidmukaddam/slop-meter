"""Build the paragraph corpus, the generation seeds, and the M0 eval set.

Human:   RAID human docs (all eight domains), Reddit tldr-17 (2006-2016),
         Yelp reviews, English Wikipedia.
Machine: RAID generations (11 older models), WildChat (GPT-3.5/GPT-4 replies to real
         users, 2023-24), Magpie (Llama 3.1 70B), and data/gen.jsonl from generate.ts.
Mixed:   RAID human/machine splices and model-polished human paragraphs (gen.jsonl).
Adversarial: anti-tell text from holdout models, held out entirely, and the RAID paraphrase
         attacks whose source document falls in the test bucket. The other paraphrases train.
Web (held out entirely): C4 paragraphs from all eight shards of the April 2019 crawl, as a
         browser renders them.

Writes data/corpus.jsonl rows {text, label, source, domain, model, group, split, modern},
data/seeds.jsonl and ../eval/labeled.jsonl.
"""

import gzip
import json
import math
import random
import re
import zlib
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import pyarrow.parquet as pq

DATA = Path(__file__).parent / "data"
EVAL = Path(__file__).parent.parent / "eval"
MIN_WORDS = 25
PER_DOC = 2
MAX_SPLICES = 1200
PUBLIC_MACHINE_PER_SOURCE = 3000
EVAL_QUOTA = {"human": 90, "machine": 70, "mixed": 40}
WEB_EVAL = 24000
C4_TRAIN_PAGES = 3000
PER_SHARD = 6000

SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+")
CODE = re.compile(r'```|^\s{4}\S|[{};]\s*$|^\s*"[^"\n]{1,60}"\s*:', re.MULTILINE)
SOFT_WRAP = re.compile(r"(?<!\n)\n(?!\n)")
MODERN_SOURCES = {"wildchat", "magpie"}

def rng_for(key) -> random.Random:
    """A generator of its own per document (or source), so adding data never re-cuts or re-draws the rest."""
    return random.Random(zlib.crc32(str(key).encode()))

def target_words(rng: random.Random) -> int:
    """A paragraph length like those on real pages (C4 blocks of 25+ words: median about 45, long tail).
    Cuts land after the sentence that crosses the target, so the draw sits a little lower."""
    return max(MIN_WORDS, int(math.exp(rng.gauss(math.log(40), 0.65))))

def paragraphs(text: str, rng: random.Random, limit: int = PER_DOC) -> list[str]:
    """Blank-line paragraphs of 25+ words, cut at sentence ends to lengths drawn for every source alike.
    Each source used to keep its own lengths, so length alone told human from machine."""
    out = []
    for block in re.split(r"\n\s*\n", text.strip()):
        block = re.sub(r"[ \t]+", " ", block.strip())
        if len(block.split()) < MIN_WORDS:
            continue
        out.extend(chunk(block, rng))
        if len(out) >= limit:
            break
    return out[:limit]

def chunk(block: str, rng: random.Random) -> list[str]:
    """Cuts after the sentence that reaches each drawn length; text between cuts keeps its line breaks."""
    chunks, start, target = [], 0, target_words(rng)
    for end in [m.start() for m in SENTENCE_BREAK.finditer(block)] + [len(block)]:
        if len(block[start:end].split()) >= target:
            chunks.append(block[start:end].strip())
            start, target = end, target_words(rng)
    rest = block[start:].strip()
    if len(rest.split()) >= MIN_WORDS:
        chunks.append(rest)
    return chunks

def split_for(group: str) -> str:
    """By source document, so versions of one document never straddle splits. crc32 is stable across runs."""
    bucket = zlib.crc32(str(group).encode()) % 100
    if bucket < 15:
        return "test"
    return "val" if bucket < 25 else "train"

class Corpus:
    def __init__(self):
        self.rows: list[dict] = []

    def append(self, text: str, cut: bool = True, split: str | None = None, **fields) -> int:
        """Every row enters here: {label, source, domain, model, group} fields. A cut text gets lengths
        drawn from its document's own generator; cut=False keeps it whole. Returns the rows added."""
        group, source = fields["group"], fields["source"]
        texts = paragraphs(text, rng_for(group)) if cut else [text]
        for p in texts:
            self.rows.append(
                {
                    "text": p,
                    **fields,
                    "split": split or split_for(group),
                    "modern": source in MODERN_SOURCES or source.startswith("gateway"),
                }
            )
        return len(texts)

def add_raid(corpus: Corpus) -> tuple[pd.DataFrame, pd.DataFrame]:
    raid = pd.read_parquet(DATA / "raid_slim.parquet")
    abstracts = raid.domain == "abstracts"
    raid.loc[abstracts, "generation"] = raid.loc[abstracts, "generation"].str.replace(SOFT_WRAP, " ", regex=True)
    human = raid[(raid.model == "human") & (raid.attack == "none")]
    for domain, group in human.groupby("domain"):
        sample = group.sample(min(len(group), 400 if domain == "poetry" else 1500), random_state=1)
        for r in sample.itertuples():
            corpus.append(r.generation, label="human", source="raid", domain=domain, model="human", group=r.id)

    clean = raid[(raid.model != "human") & (raid.attack == "none") & raid.decoding.isin(["greedy", "sampling"])]
    for (domain, model), group in clean.groupby(["domain", "model"]):
        # Per domain and model, halved when the corpus grew from four RAID domains to eight.
        # These are 2023-era models: left at the old rate they doubled their share of the
        # machine class and the meter got worse at the text current models write.
        sample = group.sample(min(len(group), 20 if domain == "poetry" else 80), random_state=2)
        for r in sample.itertuples():
            corpus.append(r.generation, label="machine", source="raid", domain=domain, model=model, group=r.source_id)

    paraphrased = raid[(raid.model != "human") & (raid.attack == "paraphrase")]
    for (domain, model), group in paraphrased.groupby(["domain", "model"]):
        for r in group.sample(min(len(group), 20), random_state=3).itertuples():
            # Paraphrase used to be held out whole, which left the model to meet its first
            # paraphrase in the wild. Source documents in the test bucket stay held out and
            # keep the adversarial report honest; the rest train like any other machine text.
            corpus.append(
                r.generation,
                split="adv" if split_for(r.source_id) == "test" else None,
                label="machine",
                source="raid-paraphrase",
                domain=domain,
                model=model,
                group=r.source_id,
            )
    return human, clean

def add_splices(corpus: Corpus, human: pd.DataFrame, machine: pd.DataFrame) -> None:
    """First half of a human paragraph, second half of a machine paragraph written for the same source."""
    by_source = machine.groupby("source_id")
    humans = human.set_index("id")
    spliced = 0
    for source_id in rng_for("raid-splice").sample(list(by_source.groups), 3000):
        if source_id not in humans.index or spliced >= MAX_SPLICES:
            continue
        rng = rng_for(source_id)
        human_para = paragraphs(humans.loc[source_id].generation, rng, 1)
        machine_para = paragraphs(by_source.get_group(source_id).sample(1, random_state=4).iloc[0].generation, rng, 1)
        if not human_para or not machine_para:
            continue
        h, m = SENTENCE_BREAK.split(human_para[0]), SENTENCE_BREAK.split(machine_para[0])
        if len(h) < 2 or len(m) < 2:
            continue
        text = " ".join(h[: max(1, len(h) // 2)] + m[len(m) // 2 :])
        if len(text.split()) < MIN_WORDS:
            continue
        domain = humans.loc[source_id].domain
        corpus.append(
            text, cut=False, label="mixed", source="raid-splice", domain=domain, model="splice", group=source_id
        )
        spliced += 1

def add_web_humans(corpus: Corpus) -> list[dict]:
    """Pre-2022 human web text; each document also seeds a matched machine generation."""
    seeds = []

    reddit = pd.read_parquet(DATA / "human/reddit.parquet", columns=["content", "summary", "subreddit", "id"])
    reddit = reddit.sample(20000, random_state=5)
    reddit = reddit[reddit.content.str.split().str.len().between(60, 400)].head(2500)
    for r in reddit.itertuples():
        group = f"reddit-{r.id}"
        corpus.append(r.content, label="human", source="reddit", domain="reddit", model="human", group=group)
        seeds.append({"domain": "reddit", "group": group, "topic": f"r/{r.subreddit}: {r.summary}", "human": r.content})

    yelp = pd.read_parquet(DATA / "human/yelp.parquet").sample(6000, random_state=6)
    yelp["text"] = yelp.text.str.replace("\\n", "\n", regex=False)
    yelp = yelp[yelp.text.str.split().str.len().between(60, 400)].head(2500)
    for i, r in enumerate(yelp.itertuples()):
        group = f"yelp-{i}"
        corpus.append(r.text, label="human", source="yelp", domain="reviews", model="human", group=group)
        gist = " ".join(r.text.split()[:25])
        topic = f'a {r.label + 1}-star review of a local business; the reviewer\'s gist: "{gist}..."'
        seeds.append({"domain": "reviews", "group": group, "topic": topic, "human": r.text})

    wiki = pd.read_parquet(DATA / "human/wiki.parquet", columns=["id", "title", "text"]).sample(8000, random_state=8)
    wiki = wiki[wiki.text.str.split().str.len() > 150].head(2500)
    for r in wiki.itertuples():
        group = f"wiki-{r.id}"
        body = "\n\n".join(b for b in r.text.split("\n\n") if len(b.split()) >= MIN_WORDS)
        corpus.append(body, label="human", source="wikipedia", domain="wiki", model="human", group=group)
        seeds.append({"domain": "wiki", "group": group, "topic": r.title, "human": body})
    return seeds

def raid_seeds(human: pd.DataFrame) -> list[dict]:
    seeds = []
    for domain in ["news", "abstracts", "books"]:
        for r in human[human.domain == domain].sample(500, random_state=9).itertuples():
            seeds.append({"domain": domain, "group": r.id, "topic": r.title, "human": r.generation})
    return seeds

def add_public_machine(corpus: Corpus) -> None:
    """Existing public LLM output: prose replies only, no code."""
    wildchat = pq.read_table(
        DATA / "public/wildchat.parquet", columns=["conversation_hash", "conversation", "language", "model"]
    ).to_pylist()
    replies = [
        (row["conversation_hash"], row["model"], turn["content"])
        for row in wildchat
        if row["language"] == "English"
        for turn in row["conversation"][:4]
        if turn["role"] == "assistant"
    ]
    add_replies(corpus, replies, "wildchat")

    magpie = pq.read_table(
        DATA / "public/magpie.parquet", columns=["uuid", "model", "response", "language"]
    ).to_pylist()
    add_replies(corpus, [(r["uuid"], r["model"], r["response"]) for r in magpie if r["language"] == "EN"], "magpie")

def add_replies(corpus: Corpus, replies: list[tuple[str, str, str]], source: str) -> None:
    prose = [r for r in replies if not CODE.search(r[2])]
    rng_for(source).shuffle(prose)
    added = 0
    for group, model, text in prose:
        if added >= PUBLIC_MACHINE_PER_SOURCE:
            break
        added += corpus.append(
            text, label="machine", source=source, domain="chat", model=model, group=f"{source}-{group}"
        )

def add_generations(corpus: Corpus) -> int:
    """One generation per (group, mode). Some pairs were generated by more than one model; the one kept
    is the lowest crc32 of its model name, so the choice doesn't depend on file order."""
    path = DATA / "gen.jsonl"
    if not path.exists():
        return 0
    kept = {}
    for line in path.open():
        g = json.loads(line)
        key = (g["group"], g["source"])
        rank = (zlib.crc32(g["model"].encode()), g["text"])
        if key not in kept or rank < kept[key][0]:
            kept[key] = (rank, g)
    added = 0
    for key in sorted(kept):
        g = kept[key][1]
        added += corpus.append(
            g["text"],
            split=g.get("split"),
            label=g["label"],
            source=g["source"],
            domain=g["domain"],
            model=g["model"],
            group=g["group"],
        )
    return added

def add_c4(corpus: Corpus) -> list[dict]:
    """Web pages from before chatbots: C4 (April 2019 crawl) keeps one line per rendered block. All eight
    validation shards are read, a fixed sample of each, so the check isn't one crawl slice of the web. The
    first pages of a fixed shuffle are the web check: human rows at natural length, never trained on. Pages
    from other sites train like any human source and each seeds a machine paragraph for the same page, so
    the register of shop pages, blogs and notices can't stand in for the label."""
    paths = sorted((DATA / "web").glob("c4-validation.*.json.gz"))
    if not paths:
        return []
    rng = random.Random(19)
    docs = []
    for path in paths:
        with gzip.open(path, "rt") as f:
            shard = [json.loads(line) for line in f]
        docs += rng.sample(shard, min(len(shard), PER_SHARD))
    rng.shuffle(docs)
    added = stop = 0
    for stop, doc in enumerate(docs, 1):
        blocks = [b.strip() for b in doc["text"].split("\n") if len(b.split()) >= MIN_WORDS]
        for text in rng.sample(blocks, min(len(blocks), PER_DOC)):
            added += corpus.append(
                text, cut=False, split="web", label="human", source="c4", domain="web", model="human", group=doc["url"]
            )
        if added >= WEB_EVAL:
            break

    checked_sites = {urlparse(d["url"]).hostname for d in docs[:stop]}
    seeds = []
    for doc in docs[stop:]:
        if len(seeds) >= C4_TRAIN_PAGES:
            break
        if urlparse(doc["url"]).hostname in checked_sites:
            continue
        text = "\n\n".join(doc["text"].split("\n"))
        before = len(corpus.rows)
        if not corpus.append(text, label="human", source="c4", domain="web", model="human", group=doc["url"]):
            continue
        gist = " ".join(corpus.rows[before]["text"].split()[:25])
        topic = f'{doc["url"]}, whose own text begins "{gist}..."'
        seeds.append({"domain": "web", "group": doc["url"], "topic": topic, "human": text})
    return seeds

def eval_set(df: pd.DataFrame) -> pd.DataFrame:
    """200 test paragraphs, stratified by label and source. Labels come from provenance, not annotators,
    so they aren't biased by the tells under test."""
    test = df[df.split == "test"]
    parts = []
    for label, quota in EVAL_QUOTA.items():
        pool = test[test.label == label]
        per_source = max(1, quota // pool.source.nunique())
        picked = pool.sample(frac=1, random_state=11).groupby("source").head(per_source)
        if len(picked) < quota:
            picked = pd.concat([picked, pool.drop(picked.index).sample(quota - len(picked), random_state=12)])
        parts.append(picked.head(quota))
    return pd.concat(parts).sample(frac=1, random_state=13)

def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")

def main() -> None:
    corpus = Corpus()
    human, machine = add_raid(corpus)
    add_splices(corpus, human, machine)
    seeds = add_web_humans(corpus) + raid_seeds(human)
    add_public_machine(corpus)
    generated = add_generations(corpus)
    seeds += add_c4(corpus)
    for seed in seeds:
        seed["human"] = (paragraphs(seed["human"], rng_for(seed["group"]), 1) or [""])[0]
    write_jsonl(DATA / "seeds.jsonl", [s for s in seeds if s["human"]])
    write_jsonl(DATA / "corpus.jsonl", corpus.rows)

    df = pd.DataFrame(corpus.rows)
    labeled = eval_set(df)
    labeled[["text", "label", "source", "domain", "model"]].to_json(
        EVAL / "labeled.jsonl", orient="records", lines=True
    )

    print(f"{len(df)} paragraphs, {generated} from gen.jsonl")
    print(df.groupby(["split", "label"]).size().unstack(fill_value=0))
    print(df.groupby(["source", "label"]).size().unstack(fill_value=0))
    print("eval/labeled.jsonl", labeled.label.value_counts().to_dict())

if __name__ == "__main__":
    main()
