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
PUBLIC_MACHINE_PER_SOURCE = 6000
PER_SEED_AND_SOURCE = 2
EVAL_QUOTA = {"human": 90, "machine": 70, "mixed": 40}
WEB_EVAL = 24000
C4_TRAIN_PAGES = 12000
C4_SEED_PAGES = 3000
HUMAN_PER_SOURCE = 12000
SEEDS_PER_SOURCE = 2500
PER_SHARD = 6000
POLISH_KEPT_HUMAN = 0.8
POLISH_KEPT_MACHINE = 0.2

SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+")
CODE = re.compile(r'```|^\s{4}\S|[{};]\s*$|^\s*"[^"\n]{1,60}"\s*:', re.MULTILINE)
SOFT_WRAP = re.compile(r"(?<!\n)\n(?!\n)")
MODERN_SOURCES = {"wildchat", "magpie"}

def rng_for(key) -> random.Random:
    return random.Random(zlib.crc32(str(key).encode()))

def target_words(rng: random.Random) -> int:
    return max(MIN_WORDS, int(math.exp(rng.gauss(math.log(40), 0.65))))

def paragraphs(text: str, rng: random.Random, limit: int = PER_DOC) -> list[str]:
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
    bucket = zlib.crc32(str(group).encode()) % 100
    if bucket < 15:
        return "test"
    return "val" if bucket < 25 else "train"

class Corpus:
    def __init__(self):
        self.rows: list[dict] = []

    def append(self, text: str, cut: bool = True, split: str | None = None, **fields) -> int:
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
        sample = group.sample(min(len(group), 35 if domain == "poetry" else 140), random_state=2)
        for r in sample.itertuples():
            corpus.append(r.generation, label="machine", source="raid", domain=domain, model=model, group=r.source_id)

    paraphrased = raid[(raid.model != "human") & (raid.attack == "paraphrase")]
    for (domain, model), group in paraphrased.groupby(["domain", "model"]):
        for r in group.sample(min(len(group), 20), random_state=3).itertuples():
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
    seeds = []

    reddit = pd.read_parquet(DATA / "human/reddit.parquet", columns=["content", "summary", "subreddit", "id"])
    reddit = reddit.sample(20000, random_state=5)
    reddit = reddit[reddit.content.str.split().str.len().between(60, 400)].head(HUMAN_PER_SOURCE)
    for i, r in enumerate(reddit.itertuples()):
        group = f"reddit-{r.id}"
        corpus.append(r.content, label="human", source="reddit", domain="reddit", model="human", group=group)
        if i < SEEDS_PER_SOURCE:
            topic = f"r/{r.subreddit}: {r.summary}"
            seeds.append({"domain": "reddit", "group": group, "topic": topic, "human": r.content})

    yelp = pd.read_parquet(DATA / "human/yelp.parquet").sample(6000, random_state=6)
    yelp["text"] = yelp.text.str.replace("\\n", "\n", regex=False)
    yelp = yelp[yelp.text.str.split().str.len().between(60, 400)].head(HUMAN_PER_SOURCE)
    for i, r in enumerate(yelp.itertuples()):
        group = f"yelp-{i}"
        corpus.append(r.text, label="human", source="yelp", domain="reviews", model="human", group=group)
        if i >= SEEDS_PER_SOURCE:
            continue
        gist = " ".join(r.text.split()[:25])
        topic = f'a {r.label + 1}-star review of a local business; the reviewer\'s gist: "{gist}..."'
        seeds.append({"domain": "reviews", "group": group, "topic": topic, "human": r.text})

    wiki = pd.read_parquet(DATA / "human/wiki.parquet", columns=["id", "title", "text"]).sample(8000, random_state=8)
    wiki = wiki[wiki.text.str.split().str.len() > 150].head(HUMAN_PER_SOURCE)
    for i, r in enumerate(wiki.itertuples()):
        group = f"wiki-{r.id}"
        body = "\n\n".join(b for b in r.text.split("\n\n") if len(b.split()) >= MIN_WORDS)
        corpus.append(body, label="human", source="wikipedia", domain="wiki", model="human", group=group)
        if i < SEEDS_PER_SOURCE:
            seeds.append({"domain": "wiki", "group": group, "topic": r.title, "human": body})
    return seeds

def raid_seeds(human: pd.DataFrame) -> list[dict]:
    seeds = []
    for domain in ["news", "abstracts", "books"]:
        for r in human[human.domain == domain].sample(500, random_state=9).itertuples():
            seeds.append({"domain": domain, "group": r.id, "topic": r.title, "human": r.generation})
    return seeds

def add_public_machine(corpus: Corpus) -> None:
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

def word_pairs(text: str) -> set[tuple[str, str]]:
    words = re.findall(r"[a-z0-9']+", text.lower())
    return set(zip(words, words[1:]))

def polish_label(human: str, polished: str) -> str:
    before, after = word_pairs(human), word_pairs(polished)
    kept = len(before & after) / len(after) if after else 0.0
    if kept >= POLISH_KEPT_HUMAN:
        return "human"
    return "machine" if kept < POLISH_KEPT_MACHINE else "mixed"

def add_generations(corpus: Corpus) -> int:
    path = DATA / "gen.jsonl"
    if not path.exists():
        return 0
    originals = {}
    for line in (DATA / "seeds.jsonl").open():
        seed = json.loads(line)
        originals[seed["group"]] = seed["human"]
    by_model = {}
    for line in path.open():
        g = json.loads(line)
        by_model[(g["group"], g["source"], g["model"])] = g
    ranked = {}
    for (group, source, model), g in by_model.items():
        rank = (zlib.crc32(model.encode()), g["text"])
        ranked.setdefault((group, source), []).append((rank, g))
    added = 0
    for key in sorted(ranked):
        for _, g in sorted(ranked[key], key=lambda pair: pair[0])[:PER_SEED_AND_SOURCE]:
            count = corpus.append(
                g["text"],
                split=g.get("split"),
                label=g["label"],
                source=g["source"],
                domain=g["domain"],
                model=g["model"],
                group=g["group"],
            )
            added += count
            if g["source"] == "gateway-polish" and g["group"] in originals:
                for row in corpus.rows[len(corpus.rows) - count :]:
                    row["label"] = polish_label(originals[g["group"]], row["text"])
    return added

def add_c4(corpus: Corpus) -> list[dict]:
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
    pages = 0
    for doc in docs[stop:]:
        if pages >= C4_TRAIN_PAGES:
            break
        if urlparse(doc["url"]).hostname in checked_sites:
            continue
        text = "\n\n".join(doc["text"].split("\n"))
        before = len(corpus.rows)
        if not corpus.append(text, label="human", source="c4", domain="web", model="human", group=doc["url"]):
            continue
        pages += 1
        if pages > C4_SEED_PAGES:
            continue
        gist = " ".join(corpus.rows[before]["text"].split()[:25])
        topic = f'{doc["url"]}, whose own text begins "{gist}..."'
        seeds.append({"domain": "web", "group": doc["url"], "topic": topic, "human": text})
    return seeds

def eval_set(df: pd.DataFrame) -> pd.DataFrame:
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
