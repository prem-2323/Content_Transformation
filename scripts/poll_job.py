"""
scripts/poll_job.py
───────────────────
Submit a PDF to /multimodal/transform-pdf and watch progress live.

Usage:
    python scripts/poll_job.py path/to/file.pdf
"""
import json
import subprocess
import sys
import time

PDF  = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\premk\Music\gen ai\sample_test\Presentation1.pdf"
BASE = "http://127.0.0.1:8000"

# ── 1. Submit ─────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1 — POST /multimodal/transform-pdf")
print("=" * 60)

t0 = time.perf_counter()
r = subprocess.run(
    [
        "curl.exe", "-s", "-X", "POST",
        f"{BASE}/multimodal/transform-pdf",
        "-H", "accept: application/json",
        "-F", f"file=@{PDF};type=application/pdf",
        "-F", "output_type=summary",
        "-F", "output_types=",
        "-F", "audience=General public",
        "-F", "tone=Professional",
        "-F", "language=English",
        "-F", "detail_level=Medium",
        "-F", "objective=Inform",
    ],
    capture_output=True, text=True,
)
elapsed_post = time.perf_counter() - t0

if r.returncode != 0 or not r.stdout.strip():
    print(f"ERROR: curl failed — {r.stderr}")
    sys.exit(1)

try:
    resp = json.loads(r.stdout)
except json.JSONDecodeError:
    print(f"ERROR: unexpected response — {r.stdout}")
    sys.exit(1)

print(f"Response in {elapsed_post:.2f}s (should be < 1s):")
print(json.dumps(resp, indent=2))

if "detail" in resp:
    print(f"\nAPI ERROR: {resp['detail']}")
    sys.exit(1)

job_id = resp["job_id"]

# ── 2. Poll ───────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"STEP 2 — Polling GET /multimodal/status/{job_id}")
print("=" * 60)
print()

for poll in range(120):           # max ~6 minutes
    time.sleep(3)
    r2 = subprocess.run(
        ["curl.exe", "-s", f"{BASE}/multimodal/status/{job_id}"],
        capture_output=True, text=True,
    )
    try:
        snap = json.loads(r2.stdout)
    except json.JSONDecodeError:
        print(f"  Poll {poll+1}: bad response — {r2.stdout[:80]}")
        continue

    status   = snap.get("status", "?")
    progress = snap.get("progress", 0)
    step     = snap.get("current_step", "")

    filled = "#" * (progress // 5)
    empty  = "." * (20 - progress // 5)
    print(f"  [{filled}{empty}] {progress:3d}%  {status:<12}  {step}")

    if status == "completed":
        result = snap.get("result", {})
        fn     = result.get("filename", "?")
        imgs   = result.get("extracted_images_count", 0)
        otypes = result.get("output_types", [])
        print()
        print("=" * 60)
        print("COMPLETED ✓")
        print("=" * 60)
        print(f"  filename               : {fn}")
        print(f"  extracted_images_count : {imgs}")
        print(f"  output_types           : {otypes}")
        outputs = result.get("outputs", {})
        for ot, val in outputs.items():
            preview = str(val)[:150]
            print(f"  output [{ot}]:")
            print(f"    {preview}...")
        break

    if status == "failed":
        err = snap.get("error", "unknown error")
        print()
        print(f"FAILED ✗  {err}")
        break
else:
    print("Timed out after 6 minutes.")
