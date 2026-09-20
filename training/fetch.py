"""Download the corpus inputs that prepare.py reads.

C4: all eight English validation shards of the April 2019 crawl.
RAID: train.csv, filtered down to every domain's unattacked rows and its
paraphrase attack. The dataset's own parquet mirror stops after four domains,
so the 12 GB CSV is the only complete source. It is kept on disk while it is
read, then it can be deleted.

Run from training/: .venv/bin/python fetch.py [c4|raid]
"""

import csv
import sys
import urllib.request
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

DATA = Path(__file__).parent / "data"
C4 = "https://huggingface.co/datasets/allenai/c4/resolve/main/en/c4-validation.{:05d}-of-00008.json.gz"
RAID = "https://huggingface.co/datasets/liamdugan/raid/resolve/main/train.csv"
KEEP = ["id", "source_id", "model", "decoding", "attack", "domain", "title", "generation"]
ATTACKS = {"none", "paraphrase"}
BATCH = 50_000


def get(url: str, path: Path) -> None:
    """Resumes a part file and only accepts the download at its stated length. A dropped
    connection on a multi-gigabyte file otherwise looks exactly like a short dataset."""
    if path.exists():
        print(f"have {path.name}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_suffix(path.suffix + ".part")
    while True:
        have = part.stat().st_size if part.exists() else 0
        request = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
        try:
            with urllib.request.urlopen(request) as response, part.open("ab") as out:
                total = have + int(response.headers.get("Content-Length", 0))
                print(f"fetching {path.name}, {total / 1e9:.1f} GB", flush=True)
                while chunk := response.read(1 << 22):
                    out.write(chunk)
        except (TimeoutError, OSError) as error:
            print(f"  {error}, resuming at {part.stat().st_size:,}", flush=True)
            continue
        if part.stat().st_size >= total:
            break
        print(f"  short by {total - part.stat().st_size:,} bytes, resuming", flush=True)
    part.rename(path)


def c4() -> None:
    for shard in range(8):
        get(C4.format(shard), DATA / f"web/c4-validation.{shard:05d}-of-00008.json.gz")


def raid() -> None:
    out = DATA / "raid_slim.parquet"
    part = out.with_suffix(".part")
    csv.field_size_limit(1 << 31)
    schema = pa.schema([(name, pa.string()) for name in KEEP])
    writer = pq.ParquetWriter(part, schema, compression="zstd")
    kept = read = 0
    rows: list[list[str]] = []

    def flush() -> None:
        writer.write_table(pa.Table.from_arrays([pa.array(c) for c in zip(*rows)], schema=schema))
        rows.clear()

    source = DATA / "raid/train.csv"
    get(RAID, source)
    with source.open(encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        columns = {name: i for i, name in enumerate(next(reader))}
        take = [columns[name] for name in KEEP]
        attack, generation = columns["attack"], columns["generation"]
        for row in reader:
            read += 1
            if row[attack] in ATTACKS and row[generation].strip():
                rows.append([row[i] for i in take])
                kept += 1
                if len(rows) >= BATCH:
                    flush()
                    print(f"  {kept:,} kept of {read:,} read", flush=True)
    if rows:
        flush()
    writer.close()
    domains = pq.read_table(part, columns=["domain"]).column("domain").value_counts()
    if len(domains) < 8:
        raise SystemExit(f"only {len(domains)} domains in {source.name}, expected 8")
    part.rename(out)
    print(f"wrote {out.name}: {kept:,} rows of {read:,}, {len(domains)} domains")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "c4"):
        c4()
    if which in ("all", "raid"):
        raid()
