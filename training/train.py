import argparse
import hashlib
import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

ROOT = Path(__file__).resolve().parent.parent
TODAY = datetime.now(UTC).date().isoformat()
DATA = Path(__file__).parent / "data"
WEIGHTS = ROOT / "packages/model/weights"
CLASSES = ["human", "machine", "mixed"]
HUMAN, MACHINE = 0, 1
HIDDEN = (224, 64)
MODERN_WEIGHTS = (1.0, 2.0, 4.0)
ECE_TARGET = 0.05
TAU_ACCURACY_TARGET = 0.96
FALSE_MACHINE_CAP = 0.001
FALSE_MACHINE_CAP_LM = 0.002
TAU_GRID = np.round(np.arange(0.34, 0.99, 0.01), 2)
MIN_WORDS = 25
RULE_FIRED = 0.05
MIN_FRESH_FEEDBACK = 50
SPLITS = ["train", "val", "test", "adv", "fresh", "web"]
LENGTH_EDGES = [40, 60, 80, 120, 200]

@dataclass
class Dataset:
    names: list[str]
    spec: int
    ms_per_paragraph: float
    X: np.ndarray
    Z: np.ndarray
    y: np.ndarray
    words: np.ndarray
    rows: list[dict]
    idx: dict[str, np.ndarray]
    modern: np.ndarray
    mean: np.ndarray
    std: np.ndarray

    @property
    def dim(self) -> int:
        return self.X.shape[1]

def check_corpus(stamp: str, made_by: str) -> None:
    current = hashlib.sha256((DATA / "corpus.jsonl").read_bytes()).hexdigest()
    if stamp != current:
        raise SystemExit(f"data/corpus.jsonl changed since {made_by} ran: rerun it")

def load_dataset(feedback_path: str | None, lm: dict | None = None) -> Dataset:
    meta = json.loads((DATA / "meta.json").read_text())
    check_corpus(meta["corpus"], "featurize.ts")
    X = np.fromfile(DATA / "X.f32", dtype=np.float32).reshape(-1, meta["dim"])
    names = list(meta["names"])
    if lm:
        check_corpus(lm["corpus"], "featurize-lm.ts")
        extra = np.fromfile(DATA / "lm.f32", dtype=np.float32).reshape(-1, len(lm["features"]))
        if len(extra) != len(X) or lm["rows"] != len(X):
            raise SystemExit("data/lm.f32 doesn't match the corpus: rerun featurize-lm.ts")
        X = np.hstack([X, extra])
        names += lm["features"]
    rows = list(meta["rows"])
    if feedback_path:
        X, rows = add_feedback(X, rows, feedback_path)

    y = np.array([CLASSES.index(r["label"]) for r in rows])
    split = np.array([r["split"] for r in rows])
    unknown = set(split) - set(SPLITS)
    if unknown:
        raise SystemExit(f"unknown splits in the corpus: {sorted(unknown)}")
    idx = {s: np.where(split == s)[0] for s in SPLITS}
    mean = X[idx["train"]].mean(0)
    std = X[idx["train"]].std(0)
    std[std < 1e-4] = 1.0
    return Dataset(
        names=names,
        spec=meta["spec"],
        ms_per_paragraph=meta["msPerParagraph"],
        X=X,
        Z=((X - mean) / std).astype(np.float32),
        y=y,
        words=np.array([r["words"] for r in rows]),
        rows=rows,
        idx=idx,
        modern=np.array([r["modern"] for r in rows]),
        mean=mean,
        std=std,
    )

def add_feedback(X: np.ndarray, rows: list[dict], path: str):
    with open(path) as f:
        feedback = [json.loads(line) for line in f if line.strip()]
    feedback = [r for r in feedback if r["label"] in CLASSES and len(r["vector"]) == X.shape[1]]
    feedback.sort(key=lambda r: r["created_at"])
    cut = int(len(feedback) * 0.8)
    extra_rows = [
        {
            "label": r["label"],
            "split": "train" if i < cut else "fresh",
            "source": "feedback",
            "domain": "feedback",
            "model": "?",
            "modern": True,
            "words": -1,
        }
        for i, r in enumerate(feedback)
    ]
    extra_X = np.array([r["vector"] for r in feedback], dtype=np.float32).reshape(-1, X.shape[1])
    return np.concatenate([X, extra_X]), rows + extra_rows

def softmax(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    e = np.exp((logits - logits.max(1, keepdims=True)) / temperature)
    return e / e.sum(1, keepdims=True)

def ece(probs: np.ndarray, labels: np.ndarray, bins: int = 10) -> float:
    confidence, predicted = probs.max(1), probs.argmax(1)
    total = 0.0
    for b in range(bins):
        in_bin = (confidence > b / bins) & (confidence <= (b + 1) / bins)
        if in_bin.any():
            hit_rate = (predicted[in_bin] == labels[in_bin]).mean()
            total += in_bin.mean() * abs(hit_rate - confidence[in_bin].mean())
    return float(total)

def reliability(probs: np.ndarray, labels: np.ndarray, bins: int = 10) -> dict:
    out = {}
    for c, name in enumerate(CLASSES):
        p, truth = probs[:, c], labels == c
        points = []
        for b in range(bins):
            upper = p < (b + 1) / bins if b < bins - 1 else p <= 1
            in_bin = (p >= b / bins) & upper
            if in_bin.sum() >= 5:
                points.append(
                    {
                        "bin": b,
                        "predicted": float(p[in_bin].mean()),
                        "observed": float(truth[in_bin].mean()),
                        "n": int(in_bin.sum()),
                    }
                )
        out[name] = points
    return out

def auroc(score: np.ndarray, positive: np.ndarray) -> float | None:
    n_pos, n_neg = positive.sum(), (~positive).sum()
    if not n_pos or not n_neg:
        return None
    ranks = np.empty(len(score))
    ranks[np.argsort(score)] = np.arange(1, len(score) + 1)
    return float((ranks[positive].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))

def macro_f1(predicted: np.ndarray, labels: np.ndarray, subset: np.ndarray | None = None) -> float:
    subset = np.ones(len(labels), bool) if subset is None else subset
    scores = []
    for c in range(len(CLASSES)):
        tp = ((predicted == c) & (labels == c) & subset).sum()
        denominator = ((predicted == c) & subset).sum() + ((labels == c) & subset).sum()
        scores.append(2 * tp / max(denominator, 1))
    return float(np.mean(scores))

def metrics(probs: np.ndarray, labels: np.ndarray) -> dict:
    predicted = probs.argmax(1)
    human, machine = labels == HUMAN, labels == MACHINE
    return {
        "n": len(labels),
        "accuracy": float((predicted == labels).mean()),
        "macroF1": macro_f1(predicted, labels),
        "ece": ece(probs, labels),
        "aurocMachineVsHuman": auroc(probs[:, 1] + probs[:, 2], labels != HUMAN),
        "falseMachineRateOnHuman": float((predicted[human] == MACHINE).mean()) if human.any() else None,
        "machineRecall": float((predicted[machine] == MACHINE).mean()) if machine.any() else None,
    }

def row_weights(d: Dataset, modern_weight: float) -> np.ndarray:
    bucket = np.where(d.words < 0, -1, np.digitize(d.words, LENGTH_EDGES))
    raw = np.where(d.modern, modern_weight, 1.0)
    w = np.zeros(len(d.y))
    for split in ("train", "val"):
        rows = d.idx[split]
        for b in np.unique(bucket[rows]):
            in_bucket = rows[bucket[rows] == b]
            for c in range(len(CLASSES)):
                cell = in_bucket[d.y[in_bucket] == c]
                if len(cell):
                    w[cell] = raw[cell] * len(in_bucket) / (len(CLASSES) * raw[cell].sum())
    return np.minimum(w, 10.0).astype(np.float32)

def fit(
    d: Dataset,
    make: Callable[[], nn.Module],
    cols: list[int],
    epochs: int,
    lr=2e-3,
    wd=1e-4,
    modern_weight=1.0,
    seed=0,
) -> nn.Module:
    torch.manual_seed(seed)
    model = make()
    weights = row_weights(d, modern_weight)

    def tensors(split: str):
        rows = d.idx[split]
        return (
            torch.tensor(d.Z[rows][:, cols]),
            torch.tensor(d.y[rows]),
            torch.tensor(weights[rows]),
        )

    def loss(out, target, sample_w):
        per_row = F.cross_entropy(out, target, reduction="none")
        return (per_row * sample_w).sum() / sample_w.sum()

    Xt, yt, wt = tensors("train")
    Xv, yv, wv = tensors("val")
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)
    best_loss, best_state = float("inf"), None
    for _ in range(epochs):
        model.train()
        for batch in torch.randperm(len(Xt)).split(256):
            optimizer.zero_grad()
            loss(model(Xt[batch]), yt[batch], wt[batch]).backward()
            optimizer.step()
        model.eval()
        with torch.no_grad():
            val_loss = loss(model(Xv), yv, wv).item()
        if val_loss < best_loss:
            best_loss = val_loss
            best_state = {k: t.clone() for k, t in model.state_dict().items()}
    model.load_state_dict(best_state)
    return model

def logits_of(d: Dataset, model: nn.Module, cols: list[int], split: str) -> np.ndarray:
    with torch.no_grad():
        return model(torch.tensor(d.Z[d.idx[split]][:, cols])).numpy()

def fit_temperature(logits: np.ndarray, labels: np.ndarray) -> float:
    grid = np.exp(np.linspace(np.log(0.3), np.log(5), 200))
    rows = np.arange(len(labels))
    nll = [-np.log(softmax(logits, t)[rows, labels] + 1e-12).mean() for t in grid]
    return float(grid[int(np.argmin(nll))])

def fit_vector_scaling(logits: np.ndarray, labels: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    z, y = torch.tensor(logits, dtype=torch.float64), torch.tensor(labels)
    scale = torch.ones(len(CLASSES), dtype=torch.float64, requires_grad=True)
    shift = torch.zeros(len(CLASSES), dtype=torch.float64, requires_grad=True)
    optimizer = torch.optim.LBFGS([scale, shift], lr=0.5, max_iter=500)

    def closure():
        optimizer.zero_grad()
        loss = F.cross_entropy(z * scale + shift, y)
        loss.backward()
        return loss

    optimizer.step(closure)
    return scale.detach().numpy().astype(np.float32), shift.detach().numpy().astype(np.float32)

def make_mlp(dim: int) -> nn.Sequential:
    h1, h2 = HIDDEN
    return nn.Sequential(
        nn.Linear(dim, h1), nn.ReLU(), nn.Dropout(0.2),
        nn.Linear(h1, h2), nn.ReLU(), nn.Dropout(0.1),
        nn.Linear(h2, len(CLASSES)),
    )

def train_mlp(d: Dataset, seed: int) -> tuple[nn.Sequential, float]:
    cols = list(range(d.dim))
    val_labels, val_modern = d.y[d.idx["val"]], d.modern[d.idx["val"]]

    def val_score(model):
        predicted = logits_of(d, model, cols, "val").argmax(1)
        return (macro_f1(predicted, val_labels, val_modern) + macro_f1(predicted, val_labels, ~val_modern)) / 2

    candidates = {w: fit(d, lambda: make_mlp(d.dim), cols, 40, modern_weight=w, seed=seed) for w in MODERN_WEIGHTS}
    best = max(candidates, key=lambda w: val_score(candidates[w]))
    return candidates[best], best

def train_candidate(d: Dataset, seed: int, labels: dict, words: dict) -> dict:
    cols = list(range(d.dim))
    mlp, modern_weight = train_mlp(d, seed)
    scale, shift = fit_vector_scaling(logits_of(d, mlp, cols, "val"), labels["val"])
    layers = linear_layers(mlp)
    w, b = layers[-1]
    layers[-1] = (w * scale[:, None], b * scale + shift)
    quantized = [quantize(w, b) for w, b in layers]
    probs = lambda split: softmax(run_quantized(quantized, d.Z[d.idx[split]]))
    bars = choose_thresholds(probs("val"), words["val"], labels["val"])
    at_bars = (
        lambda split: outcome(
            probs(split), words[split], labels[split], *bars, modern=d.modern[d.idx[split]]
        )
        if bars
        else None
    )
    return {
        "seed": seed,
        "mlp": mlp,
        "modernWeight": modern_weight,
        "scale": scale,
        "shift": shift,
        "quantized": quantized,
        "bars": bars,
        "val": at_bars("val"),
        "test": at_bars("test"),
    }

def logistic_regression(d: Dataset, cols: list[int]) -> nn.Linear:
    return fit(d, lambda: nn.Linear(len(cols), len(CLASSES)), cols, 60, lr=1e-2)

def by_source(d: Dataset, probs_for) -> dict:
    out = {}
    for split in ["test", "adv", "web"]:
        probs = probs_for(split)
        predicted = probs.argmax(1)
        labels = d.y[d.idx[split]]
        sources = np.array([d.rows[i]["source"] for i in d.idx[split]])
        for source in sorted(set(sources)):
            m = sources == source
            out[f"{split}:{source}"] = {
                "n": int(m.sum()),
                "accuracy": float((predicted[m] == labels[m]).mean()),
                "predictedShare": {c: float((predicted[m] == k).mean()) for k, c in enumerate(CLASSES)},
            }
    return out

def decided(probs: np.ndarray, words: np.ndarray, tau: float, tau_machine: float) -> np.ndarray:
    bar = np.where(probs.argmax(1) == MACHINE, tau_machine, tau)
    return (words >= MIN_WORDS) & (probs.max(1) >= bar)

def outcome(
    probs: np.ndarray,
    words: np.ndarray,
    labels: np.ndarray,
    tau: float,
    tau_machine: float,
    modern: np.ndarray | None = None,
) -> dict:
    predicted = probs.argmax(1)
    called = decided(probs, words, tau, tau_machine)
    mixed_calls = called & (predicted == 2)
    caught = (predicted == MACHINE) & called
    modern_machine = (labels == MACHINE) if modern is None else (labels == MACHINE) & modern
    return {
        "unsureRate": float(1 - called.mean()),
        "accuracyDecided": float((predicted[called] == labels[called]).mean()) if called.any() else None,
        "falseMachineRateOnHuman": float(caught[labels == HUMAN].mean()),
        "mixedPrecision": float((labels[mixed_calls] == 2).mean()) if mixed_calls.any() else None,
        "modernMachineCaught": float(caught[modern_machine].mean()) if modern_machine.any() else 0.0,
        "decided": int(called.sum()),
    }

def calls(probs: np.ndarray, words: np.ndarray, tau: float, tau_machine: float) -> dict:
    called = decided(probs, words, tau, tau_machine)
    return {c: float((called & (probs.argmax(1) == k)).mean()) for k, c in enumerate(CLASSES)}

def wilson_low(p: float, n: int, z: float = 1.96) -> float:
    if n == 0:
        return 0.0
    centre = p + z * z / (2 * n)
    spread = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return float((centre - spread) / (1 + z * z / n))

def choose_thresholds(probs: np.ndarray, words: np.ndarray, labels: np.ndarray) -> tuple[float, float] | None:
    best = None
    for tau_machine in TAU_GRID:
        for tau in TAU_GRID:
            o = outcome(probs, words, labels, tau, tau_machine)
            accurate = wilson_low(o["accuracyDecided"] or 0, o["decided"]) >= TAU_ACCURACY_TARGET
            if accurate and o["falseMachineRateOnHuman"] <= FALSE_MACHINE_CAP:
                if best is None or o["unsureRate"] < best[0]:
                    best = (o["unsureRate"], float(tau), float(tau_machine))
                break
    return (best[1], best[2]) if best else None

def decision_curves(probs: np.ndarray, words: np.ndarray, labels: np.ndarray, tau: float, tau_machine: float) -> dict:
    return {
        "other": [{"tau": float(t), **outcome(probs, words, labels, t, tau_machine)} for t in TAU_GRID],
        "machine": [{"tau": float(t), **outcome(probs, words, labels, tau, t)} for t in TAU_GRID],
    }

def rule_weights(d: Dataset, rule_cols: list[int]) -> dict:
    W = logistic_regression(d, rule_cols).weight.detach().numpy()
    fired = d.X[:, rule_cols] > RULE_FIRED
    return {
        d.names[c]: {
            "weight": float(W[MACHINE, j] - W[HUMAN, j]),
            "fireRateHuman": float(fired[d.y == HUMAN, j].mean()),
            "fireRateMachine": float(fired[d.y == MACHINE, j].mean()),
        }
        for j, c in enumerate(rule_cols)
    }

@dataclass
class QuantLayer:
    q: np.ndarray
    scale: np.ndarray
    bias: np.ndarray

def quantize(weight: np.ndarray, bias: np.ndarray) -> QuantLayer:
    scale = np.maximum(np.abs(weight).max(1), 1e-8) / 127.0
    q = np.clip(np.round(weight / scale[:, None]), -127, 127).astype(np.int8)
    return QuantLayer(q, scale.astype(np.float32), bias.astype(np.float32))

def run_quantized(layers: list[QuantLayer], z: np.ndarray) -> np.ndarray:
    h = z
    for i, layer in enumerate(layers):
        h = h @ (layer.q.astype(np.float32) * layer.scale[:, None]).T + layer.bias
        if i < len(layers) - 1:
            h = np.maximum(h, 0)
    return h

def linear_layers(model: nn.Module) -> list[tuple[np.ndarray, np.ndarray]]:
    return [
        (m.weight.detach().numpy().astype(np.float32), m.bias.detach().numpy().astype(np.float32))
        for m in model.modules()
        if isinstance(m, nn.Linear)
    ]

def pack(d: Dataset, layers: list[QuantLayer]) -> tuple[bytes, dict, list[dict]]:
    blob = bytearray()

    def put(array: np.ndarray) -> int:
        offset = len(blob)
        blob.extend(array.tobytes())
        blob.extend(b"\0" * (-len(blob) % 4))
        return offset

    normalization = {"mean": put(d.mean.astype("<f4")), "std": put(d.std.astype("<f4"))}
    layout = [
        {
            "inputs": l.q.shape[1],
            "outputs": l.q.shape[0],
            "weights": put(l.q),
            "scales": put(l.scale.astype("<f4")),
            "bias": put(l.bias.astype("<f4")),
        }
        for l in layers
    ]
    return bytes(blob), normalization, layout

def read_shipped(out: Path, dim: int) -> tuple[dict, np.ndarray, np.ndarray, list[QuantLayer]]:
    manifest = json.loads((out / "manifest.json").read_text())
    blob = (out / "model.bin").read_bytes()
    f32 = lambda offset, n: np.frombuffer(blob, dtype="<f4", count=n, offset=offset)
    layers = [
        QuantLayer(
            np.frombuffer(blob, np.int8, l["inputs"] * l["outputs"], l["weights"]).reshape(l["outputs"], l["inputs"]),
            f32(l["scales"], l["outputs"]),
            f32(l["bias"], l["outputs"]),
        )
        for l in manifest["layers"]
    ]
    norm = manifest["normalization"]
    return manifest, f32(norm["mean"], dim), f32(norm["std"], dim), layers

def retrain_gate(d: Dataset, out: Path, new_layers: list[QuantLayer]) -> dict:
    manifest, mean, std, old_layers = read_shipped(out, d.dim)
    fresh = d.idx["fresh"]
    human_test = d.idx["test"][d.y[d.idx["test"]] == HUMAN]
    old = lambda rows: softmax(run_quantized(old_layers, (d.X[rows] - mean) / std), manifest["temperature"])
    new = lambda rows: softmax(run_quantized(new_layers, d.Z[rows]))
    has_fresh = len(fresh) > 0
    gate = {
        "freshN": len(fresh),
        "eceFreshOld": ece(old(fresh), d.y[fresh]) if has_fresh else None,
        "eceFreshNew": ece(new(fresh), d.y[fresh]) if has_fresh else None,
        "falseMachineOld": float((old(human_test).argmax(1) == MACHINE).mean()),
        "falseMachineNew": float((new(human_test).argmax(1) == MACHINE).mean()),
    }
    gate["ship"] = bool(
        len(fresh) >= MIN_FRESH_FEEDBACK
        and gate["eceFreshNew"] < gate["eceFreshOld"]
        and gate["falseMachineNew"] <= gate["falseMachineOld"]
    )
    return gate

def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, indent=1, allow_nan=False))

def next_version(previous: str, suffix: str) -> str:
    previous = previous.removesuffix(suffix)
    if not previous.startswith(TODAY):
        return TODAY + suffix
    count = int(previous.split(".")[1]) if "." in previous else 1
    return f"{TODAY}.{count + 1}{suffix}"

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--feedback", help='jsonl of {vector, label, created_at}; the newest 20%% is held out as "fresh"'
    )
    parser.add_argument("--lm", action="store_true", help="train the sharper model on data/lm.f32 as well")
    parser.add_argument(
        "--ablate", help="comma-separated features to zero out; writes eval/ablation-<ids>.json and ships nothing"
    )
    parser.add_argument(
        "--seeds", type=int, default=5, help="train this many seeds; the one catching the most current-model text on val, within the false-machine cap, ships"
    )
    args = parser.parse_args()
    if args.lm and args.feedback:
        parser.error("--feedback retrains the base model only: feedback vectors carry no LM features")
    if args.seeds < 1:
        parser.error("--seeds must be at least 1")
    if args.ablate and args.feedback:
        parser.error("--ablate measures a feature against the shipped recipe: leave out --feedback")

    lm = json.loads((DATA / "lm.json").read_text()) if args.lm else None
    if lm:
        global FALSE_MACHINE_CAP
        FALSE_MACHINE_CAP = FALSE_MACHINE_CAP_LM
    out, report_path, suffix = (
        (WEIGHTS / "lm", ROOT / "eval/report-lm.json", "-lm") if lm else (WEIGHTS, ROOT / "eval/report.json", "")
    )
    d = load_dataset(args.feedback, lm)
    ablated = args.ablate.split(",") if args.ablate else []
    for name in ablated:
        if name not in d.names:
            parser.error(f"--ablate: no feature named {name}")
        d.X[:, d.names.index(name)] = 0
        d.Z[:, d.names.index(name)] = 0
    if ablated:
        report_path = ROOT / f"eval/ablation-{'-'.join(ablated)}{suffix}.json"
    rulebook = {r["id"]: r for r in json.loads((ROOT / "packages/rules/rules.json").read_text())}
    rule_cols = [i for i, name in enumerate(d.names) if name.startswith("r-")]
    tier12_cols = [i for i in rule_cols if rulebook[d.names[i]]["tier"] in ("lexical", "punctuation")]
    all_cols = list(range(d.dim))
    labels = {split: d.y[d.idx[split]] for split in SPLITS}
    words = {split: d.words[d.idx[split]] for split in SPLITS}
    report = {
        "date": TODAY,
        "corpus": {s: {c: int((labels[s] == k).sum()) for k, c in enumerate(CLASSES)} for s in SPLITS},
        "featureMsPerParagraph": d.ms_per_paragraph,
        "eceTarget": ECE_TARGET,
    }

    baseline = logistic_regression(d, tier12_cols)
    baseline_t = fit_temperature(logits_of(d, baseline, tier12_cols, "val"), labels["val"])
    baseline_probs = lambda split: softmax(logits_of(d, baseline, tier12_cols, split), baseline_t)
    report["baseline"] = {
        "model": "logistic regression, tier 1-2 rule features",
        "features": len(tier12_cols),
        "temperature": baseline_t,
        "test": metrics(baseline_probs("test"), labels["test"]),
        "adv": metrics(baseline_probs("adv"), labels["adv"]),
    }

    started = time.time()
    tried = [train_candidate(d, seed, labels, words) for seed in range(args.seeds)]
    chosen = max(
        (c for c in tried if c["bars"]),
        key=lambda c: (c["val"]["modernMachineCaught"], -c["val"]["falseMachineRateOnHuman"]),
        default=tried[0],
    )
    mlp, modern_weight, scale, shift, quantized, bars = (
        chosen[k] for k in ("mlp", "modernWeight", "scale", "shift", "quantized", "bars")
    )
    mlp_probs = lambda split: softmax(logits_of(d, mlp, all_cols, split) * scale + shift)
    test_probs = mlp_probs("test")
    report["model"] = {
        "arch": f"MLP {d.dim}-{HIDDEN[0]}-{HIDDEN[1]}-3 ReLU",
        "params": sum(p.numel() for p in mlp.parameters()),
        "modernWeight": modern_weight,
        "seed": chosen["seed"],
        "seeds": [
            {k: c[k] for k in ("seed", "modernWeight", "bars", "val", "test")} for c in tried
        ],
        "trainSeconds": round(time.time() - started, 1),
        "calibration": {"method": "vector scaling", "scale": scale.tolist(), "shift": shift.tolist()},
        "testUncalibrated": metrics(softmax(logits_of(d, mlp, all_cols, "test")), labels["test"]),
        "test": metrics(test_probs, labels["test"]),
        "adv": metrics(mlp_probs("adv"), labels["adv"]),
        "reliability": reliability(test_probs, labels["test"]),
        "bySource": by_source(d, mlp_probs),
    }

    model_report, baseline_report = report["model"], report["baseline"]
    report["m2Exit"] = {
        "beatsBaselineOnTest": model_report["test"]["macroF1"] > baseline_report["test"]["macroF1"],
        "beatsBaselineOnAdversarial": model_report["adv"]["accuracy"] >= baseline_report["adv"]["accuracy"],
        "calibrated": model_report["test"]["ece"] < ECE_TARGET,
    }

    quantized_probs = lambda split: softmax(run_quantized(quantized, d.Z[d.idx[split]]))
    quantized_test = quantized_probs("test")
    report["quantization"] = {
        "maxAbsProbDelta": float(np.abs(quantized_test - test_probs).max()),
        "test": metrics(quantized_test, labels["test"]),
    }
    report["m2Exit"]["meetsAccuracyTarget"] = bars is not None
    if not all(report["m2Exit"].values()):
        write_json(report_path, report)
        raise SystemExit(f"the model misses its exit criteria, nothing exported: {report['m2Exit']}")
    tau, tau_machine = bars
    report["decision"] = {
        "tau": tau,
        "tauMachine": tau_machine,
        "accuracyTarget": TAU_ACCURACY_TARGET,
        "falseMachineCap": FALSE_MACHINE_CAP,
        "shipped": outcome(quantized_test, words["test"], labels["test"], tau, tau_machine),
        "curves": decision_curves(quantized_test, words["test"], labels["test"], tau, tau_machine),
    }
    if len(labels["web"]):
        web_probs = quantized_probs("web")
        report["decision"]["web"] = {"n": len(labels["web"]), **calls(web_probs, words["web"], tau, tau_machine)}

    if args.feedback:
        gate = retrain_gate(d, out, quantized)
        report["retrainGate"] = gate
        write_json(ROOT / "eval/retrain-report.json", dict(date=TODAY, **gate))
        print("retrain gate", gate)
        if not gate["ship"]:
            print("gate failed: keeping the shipped model")
            return

    if ablated:
        write_json(report_path, report)
        print(f"ablation {ablated}: {report['decision']['shipped']}, web {report['decision'].get('web')}")
        return

    previous = out / "manifest.json"
    version = next_version(json.loads(previous.read_text())["version"] if previous.exists() else "", suffix)
    blob, normalization, layout = pack(d, quantized)
    out.mkdir(parents=True, exist_ok=True)
    (out / "model.bin").write_bytes(blob)
    write_json(
        out / "manifest.json",
        {
            "spec": d.spec,
            "version": version,
            "classes": CLASSES,
            "features": d.names,
            "normalization": normalization,
            "layers": layout,
            "activation": "relu",
            "temperature": 1.0,
            "tau": tau,
            "tauMachine": tau_machine,
            "minWords": MIN_WORDS,
            "bytes": len(blob),
            "params": int(sum(l.q.size + l.bias.size for l in quantized)),
            **({"lm": {k: lm[k] for k in ("repo", "dtype", "maxTokens", "features")}} if lm else {}),
        },
    )
    if not lm:
        write_json(
            ROOT / "packages/rules/weights.json",
            {
                "date": TODAY,
                "method": "logistic regression on rule features; weight = machine logit - human logit per standardized unit",
                "rules": rule_weights(d, rule_cols),
            },
        )
    write_json(report_path, report)

    for name in ["baseline", "model"]:
        for split in ["test", "adv"]:
            numbers = {k: round(v, 3) for k, v in report[name][split].items() if isinstance(v, float)}
            print(f"{name:8s} {split:4s} {numbers}")
    shipped_outcome = report["decision"]["shipped"]
    print(
        f"shipped {version} (seed {chosen['seed']} of {len(tried)}), bars {tau} / machine {tau_machine}, {len(blob)} bytes; "
        f"test: right on calls {shipped_outcome['accuracyDecided']:.3f}, can't tell {shipped_outcome['unsureRate']:.3f}, "
        f"human called machine {shipped_outcome['falseMachineRateOnHuman']:.4f}"
    )
    if "web" in report["decision"]:
        web = report["decision"]["web"]
        print(f"web (2019 pages, all human): machine-ish {web['machine']:.4f}, human-ish {web['human']:.3f}, mixed {web['mixed']:.4f}")

if __name__ == "__main__":
    main()
