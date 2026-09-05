"""
scripts/benchmark_gemma.py
──────────────────────────
Benchmark Gemma image analysis with different concurrency limits.

Usage:
    python scripts/benchmark_gemma.py path/to/your.pdf [--runs N]

What it measures:
    • Sequential (limit = 1) — images analyzed one by one, the old behaviour
    • Parallel-2  (limit = 2) — current default, 2 in-flight at a time
    • Parallel-3  (limit = 3) — push it harder; watch for CUDA OOM / timeouts

Cache is cleared between every timed run so every measurement hits Ollama for real.

Example output:
    PDF: report.pdf  |  4 images extracted

    Concurrency   Time (s)   vs Sequential   Status
    ──────────────────────────────────────────────────
    1 (sequential)   48.3 s        –           ✓ OK
    2 (parallel)     25.1 s      -48%          ✓ OK
    3 (parallel)     23.8 s      -51%          ✓ OK

    Recommendation: MAX_CONCURRENT_IMAGES = 2
"""

import argparse
import asyncio
import io
import sys
import time
from pathlib import Path

# ── Make sure the project root is on sys.path ─────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from PIL import Image
from pypdf import PdfReader

import visual.gemma_model as gemma_module
from visual.gemma_model import GemmaModel


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def extract_images_from_pdf(pdf_path: str) -> list[Image.Image]:
    """Return all PIL images embedded in a PDF."""
    images: list[Image.Image] = []
    with open(pdf_path, "rb") as f:
        reader = PdfReader(f)
        for page in reader.pages:
            for image_file in page.images:
                try:
                    pil_img = Image.open(io.BytesIO(image_file.data)).convert("RGB")
                    images.append(pil_img)
                except Exception:
                    continue
    return images


def clear_cache() -> None:
    """Wipe the in-process Gemma image cache so timings are genuine."""
    gemma_module._image_cache.clear()


async def run_with_limit(
    images: list[Image.Image],
    concurrency: int,
    model: GemmaModel,
) -> tuple[float, list[dict]]:
    """
    Analyze all images with the given semaphore limit.

    Returns (elapsed_seconds, results).
    """
    semaphore = asyncio.Semaphore(concurrency)

    async def _analyze(idx: int, img: Image.Image) -> dict:
        async with semaphore:
            t0 = time.perf_counter()
            print(f"  [limit={concurrency}] Starting  image {idx}", flush=True)
            try:
                result = await model.analyze_image(
                    image=img,
                    prompt=f"Analyze page image {idx} for text, objects, and summary details.",
                    task="summary",
                )
                elapsed = time.perf_counter() - t0
                print(
                    f"  [limit={concurrency}] Completed image {idx} in {elapsed:.1f}s",
                    flush=True,
                )
                return {"image_index": idx, "success": True, "result": result}
            except Exception as err:
                elapsed = time.perf_counter() - t0
                print(
                    f"  [limit={concurrency}] FAILED    image {idx} after {elapsed:.1f}s — {err}",
                    flush=True,
                )
                return {"image_index": idx, "success": False, "error": str(err)}

    tasks = [_analyze(idx, img) for idx, img in enumerate(images, 1)]

    clear_cache()
    t_start = time.perf_counter()
    results = list(await asyncio.gather(*tasks))
    elapsed = time.perf_counter() - t_start

    return elapsed, results


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

async def main(pdf_path: str, runs: int) -> None:
    print(f"\n{'─'*60}")
    print(f"  Gemma Concurrency Benchmark")
    print(f"{'─'*60}")

    images = extract_images_from_pdf(pdf_path)
    pdf_name = Path(pdf_path).name

    if not images:
        print(f"\n  ✗ No embedded images found in {pdf_name}.")
        print("  Try a different PDF that contains embedded images.")
        sys.exit(1)

    print(f"  PDF    : {pdf_name}")
    print(f"  Images : {len(images)}")
    print(f"  Runs   : {runs} per concurrency level")
    print()

    model = GemmaModel()

    limits_to_test = [1, 2, 3]
    timings: dict[int, list[float]] = {lim: [] for lim in limits_to_test}
    statuses: dict[int, str] = {}

    for limit in limits_to_test:
        label = "sequential" if limit == 1 else f"parallel-{limit}"
        print(f"  ── Testing concurrency = {limit} ({label}) ──")
        run_times: list[float] = []

        for run in range(1, runs + 1):
            print(f"  Run {run}/{runs}:")
            try:
                elapsed, results = await run_with_limit(images, limit, model)
                failures = [r for r in results if not r.get("success", True)]
                run_times.append(elapsed)
                status = "✓ OK" if not failures else f"⚠ {len(failures)} image(s) failed"
                print(f"  → {elapsed:.1f}s  {status}\n")
            except Exception as err:
                print(f"  → ERROR: {err}\n")
                statuses[limit] = f"✗ ERROR: {err}"
                break

        if run_times:
            avg = sum(run_times) / len(run_times)
            timings[limit] = run_times
            if limit not in statuses:
                statuses[limit] = "✓ OK"
            print(f"  Average for limit={limit}: {avg:.1f}s\n")

    # ── Results table ────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print(f"  RESULTS — {pdf_name}  ({len(images)} images)")
    print(f"{'─'*60}")
    print(f"  {'Concurrency':<18} {'Avg time':>10}  {'vs Sequential':>14}  Status")
    print(f"  {'─'*18} {'─'*10}  {'─'*14}  {'─'*10}")

    seq_avg = (sum(timings[1]) / len(timings[1])) if timings.get(1) else None

    for limit in limits_to_test:
        if not timings.get(limit):
            label = f"{limit} (sequential)" if limit == 1 else f"{limit} (parallel)"
            print(f"  {label:<18} {'N/A':>10}  {'N/A':>14}  {statuses.get(limit, 'not run')}")
            continue

        avg = sum(timings[limit]) / len(timings[limit])
        label = f"{limit} (sequential)" if limit == 1 else f"{limit} (parallel)"

        if seq_avg and limit != 1:
            pct = (avg - seq_avg) / seq_avg * 100
            vs_seq = f"{pct:+.0f}%"
        else:
            vs_seq = "baseline"

        print(f"  {label:<18} {avg:>9.1f}s  {vs_seq:>14}  {statuses.get(limit, '?')}")

    print()

    # ── Recommendation ───────────────────────────────────────────────────────
    if seq_avg and len([t for t in timings.values() if t]) >= 2:
        best_limit = min(
            (lim for lim in limits_to_test if timings.get(lim) and statuses.get(lim, "").startswith("✓")),
            key=lambda lim: sum(timings[lim]) / len(timings[lim]),
        )
        print(f"  Recommendation: MAX_CONCURRENT_IMAGES = {best_limit}")
        print()
        print("  If you saw CUDA OOM, slowdowns or timeouts at limit=3,")
        print("  set MAX_CONCURRENT_IMAGES = 2 in multimodal/service.py.")

    print(f"{'─'*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Benchmark Gemma image analysis: sequential vs parallel"
    )
    parser.add_argument("pdf", help="Path to a PDF file containing embedded images")
    parser.add_argument(
        "--runs",
        type=int,
        default=1,
        help="Number of timed runs per concurrency level (default: 1)",
    )
    args = parser.parse_args()
    asyncio.run(main(args.pdf, args.runs))
