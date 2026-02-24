#!/usr/bin/env python3
"""
Test script to validate audit event normalization.

Usage:
  1. Offline (mock data):     python test_normalization.py
  2. Against running app:     python test_normalization.py https://your-app-url.domino.tech
  3. Against raw JSON file:   python test_normalization.py --file raw_events.json
"""
import json
import sys
from pathlib import Path

# Import the normalization function from our app
sys.path.insert(0, str(Path(__file__).parent))
from app import _normalize_audit_event


FIELDS_TO_CHECK = [
    "command", "status", "hardwareTier", "environmentName", "runId",
    "durationSec", "computeTier", "runType", "runFile", "runOrigin",
    "actorName", "withinProjectName", "jobId",
]


def test_event(label: str, raw: dict, expected: dict):
    """Normalize a raw event and compare against expected values."""
    result = _normalize_audit_event(raw)
    passed = 0
    failed = 0
    print(f"\n{'='*70}")
    print(f"TEST: {label}")
    print(f"{'='*70}")

    for field in FIELDS_TO_CHECK:
        actual = result.get(field)
        exp = expected.get(field, "__SKIP__")
        if exp == "__SKIP__":
            display = actual if actual not in (None, "", "Unknown") else "⊘ (empty)"
            print(f"  {field:20s} = {display}")
            continue
        ok = (actual == exp) if exp is not None else (actual is None)
        status = "✓" if ok else "✗"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  {status} {field:20s} expected={exp!r:30s} got={actual!r}")

    print(f"\n  Result: {passed} passed, {failed} failed")
    return failed == 0


def run_mock_tests():
    """Run tests with mock events matching the formats we've seen."""
    all_passed = True

    # ─── Test 1: Title-case keys with spaces (from Domino Audit Trail UI screenshot) ───
    # This is the exact format seen in the Domino UI "Custom Attributes" table.
    all_passed &= test_event(
        "Title-case keys in metadata (Domino UI format)",
        {
            "id": "evt-001",
            "timestamp": 1740415405000,
            "actor": {"id": "690a9213abfd2c18541c6a98", "name": "integration-test"},
            "action": {"eventName": "Publish App"},
            "in": {"id": "proj-001", "name": "tendler3"},
            "targets": [{"entity": {"id": "698cef1096d43e5478ae931f", "entityType": "app", "name": "tendler3"}}],
            "metadata": {
                "Run Origin": "User",
                "Run Command": "App server",
                "Run File": "App server",
                "Autoscaling Enabled": "true",
                "Run": "699deef517b54d3d2b7ddea0",
                "Dataset": "tendler3",
                "Environment": "Domino Standard Environment Py3.10 R4.4",
                "Hardware Tier": "Small",
            },
        },
        {
            "command": "App server",
            "hardwareTier": "Small",
            "environmentName": "Domino Standard Environment Py3.10 R4.4",
            "runId": "699deef517b54d3d2b7ddea0",
            "runFile": "App server",
            "runOrigin": "User",
            "actorName": "integration-test",
            "withinProjectName": "tendler3",
        },
    )

    # ─── Test 2: Title-case keys in targets[0].customAttributes ───
    # Some Domino versions may put custom attributes under target rather than metadata.
    all_passed &= test_event(
        "Title-case keys in targets[0].customAttributes",
        {
            "id": "evt-002",
            "timestamp": 1740415405000,
            "actor": {"id": "user-1", "name": "alice"},
            "action": {"eventName": "Start Run"},
            "in": {"id": "proj-002", "name": "my-project"},
            "targets": [{
                "entity": {"id": "run-abc123", "entityType": "Run", "name": "my-project"},
                "customAttributes": {
                    "Run Command": "python train.py",
                    "Run File": "train.py",
                    "Environment": "Domino Analytics Env",
                    "Hardware Tier": "Medium",
                    "Run": "run-abc123",
                    "Run Origin": "Scheduled",
                },
            }],
            "metadata": {},
        },
        {
            "command": "python train.py",
            "hardwareTier": "Medium",
            "environmentName": "Domino Analytics Env",
            "runId": "run-abc123",
            "runFile": "train.py",
            "runOrigin": "Scheduled",
        },
    )

    # ─── Test 3: camelCase keys (API/programmatic format) ───
    all_passed &= test_event(
        "camelCase keys in metadata (programmatic API format)",
        {
            "id": "evt-003",
            "timestamp": 1740415405000,
            "actor": {"id": "user-2", "name": "bob"},
            "action": {"eventName": "Start Run"},
            "in": {"id": "proj-003", "name": "analytics"},
            "targets": [{"entity": {"id": "run-def456", "entityType": "Run"}}],
            "metadata": {
                "runCommand": "Rscript analysis.R",
                "runFile": "analysis.R",
                "environmentName": "R Analytics Environment",
                "hardwareTierName": "Large-GPU",
                "runId": "run-def456",
                "executionStatus": "Succeeded",
                "runDurationSec": 342.5,
            },
        },
        {
            "command": "Rscript analysis.R",
            "hardwareTier": "Large-GPU",
            "environmentName": "R Analytics Environment",
            "runId": "run-def456",
            "status": "Succeeded",
            "durationSec": 342.5,
        },
    )

    # ─── Test 4: domaudit /v4/jobs-style nested objects ───
    all_passed &= test_event(
        "Nested objects (domaudit /v4/jobs style)",
        {
            "id": "evt-004",
            "timestamp": 1740415405000,
            "actor": {"id": "user-3"},
            "action": {"eventName": "Complete Job"},
            "in": {"id": "proj-004", "name": "ml-pipeline"},
            "targets": [{"entity": {"id": "job-789", "entityType": "job"}}],
            "metadata": {
                "jobRunCommand": "python pipeline.py",
                "startedBy": {"username": "charlie"},
                "environment": {"environmentName": "MLflow Env"},
                "hardwareTier": {"name": "xlarge"},
                "statuses": {"executionStatus": "Succeeded"},
                "stageTime": {
                    "submissionTime": 1740410000000,
                    "runStartTime": 1740411000000,
                    "completedTime": 1740415000000,
                },
            },
        },
        {
            "command": "python pipeline.py",
            "actorName": "charlie",
            "environmentName": "MLflow Env",
            "hardwareTier": "xlarge",
            "status": "Succeeded",
            "durationSec": 4000.0,  # (1740415000000 - 1740411000000) / 1000
            "jobId": "job-789",
        },
    )

    # ─── Test 5: List-format customAttributes ───
    all_passed &= test_event(
        "List-format customAttributes [{key, value}, ...]",
        {
            "id": "evt-005",
            "timestamp": 1740415405000,
            "actor": {"id": "user-4", "name": "dana"},
            "action": {"eventName": "Start Run"},
            "in": {"id": "proj-005", "name": "data-science"},
            "targets": [{
                "entity": {"id": "run-list-test", "entityType": "Run"},
                "customAttributes": [
                    {"key": "Run Command", "value": "jupyter notebook"},
                    {"key": "Hardware Tier", "value": "GPU-Large"},
                    {"key": "Environment", "value": "Jupyter Data Science Env"},
                    {"key": "Run", "value": "run-list-test"},
                ],
            }],
            "metadata": {},
        },
        {
            "command": "jupyter notebook",
            "hardwareTier": "GPU-Large",
            "environmentName": "Jupyter Data Science Env",
            "runId": "run-list-test",
        },
    )

    # ─── Test 6: Mixed-case / unusual key formats ───
    all_passed &= test_event(
        "Mixed-case and unusual key formats (case-insensitive fallback)",
        {
            "id": "evt-006",
            "timestamp": 1740415405000,
            "actor": {"id": "user-5", "name": "eve"},
            "action": {"eventName": "Start Run"},
            "in": {"id": "proj-006", "name": "experiment"},
            "targets": [{"entity": {"id": "run-mixed", "entityType": "Run"}}],
            "metadata": {
                "run_command": "bash run.sh",
                "hardware_tier": "Spot-Medium",
                "ENVIRONMENT": "Custom Env v2",
            },
        },
        {
            "command": "bash run.sh",
            "hardwareTier": "Spot-Medium",
            "environmentName": "Custom Env v2",
        },
    )

    # ─── Test 7: Empty event (nothing should crash) ───
    all_passed &= test_event(
        "Empty / minimal event (no crash, all Unknown)",
        {
            "id": "evt-007",
            "timestamp": 1740415405000,
            "actor": {},
            "action": {"eventName": "Unknown Event"},
            "targets": [],
            "metadata": {},
        },
        {
            "command": None,
            "hardwareTier": None,
            "environmentName": None,
            "runId": None,
        },
    )

    return all_passed


def test_with_live_data(app_url: str):
    """Fetch raw events from a running app and test normalization."""
    import requests

    url = f"{app_url.rstrip('/')}/api/audit/raw-sample"
    print(f"\nFetching raw events from {url} ...")

    try:
        resp = requests.get(url, timeout=15, verify=False)
        if not resp.ok:
            print(f"ERROR: {resp.status_code} {resp.text[:200]}")
            return False
        raw_events = resp.json()
    except Exception as e:
        print(f"ERROR: {e}")
        return False

    print(f"Got {len(raw_events)} raw events.\n")

    for i, raw in enumerate(raw_events):
        result = _normalize_audit_event(raw)
        print(f"\n{'─'*60}")
        print(f"Event {i+1}: {result.get('event', '?')} @ {result.get('timestamp', '?')}")
        print(f"{'─'*60}")

        # Show what we extracted
        for field in FIELDS_TO_CHECK:
            val = result.get(field)
            filled = val not in (None, "", "Unknown")
            marker = "✓" if filled else "⊘"
            print(f"  {marker} {field:20s} = {val!r}")

        # Show raw metadata keys for debugging
        meta = result.get("metadata", {})
        if meta:
            print(f"  ── raw metadata keys: {list(meta.keys())[:20]}")

    # Summary
    print(f"\n{'='*60}")
    print("COVERAGE SUMMARY (from sample)")
    print(f"{'='*60}")
    results = [_normalize_audit_event(raw) for raw in raw_events]
    total = len(results)
    for field in FIELDS_TO_CHECK:
        filled = sum(1 for r in results if r.get(field) not in (None, "", "Unknown"))
        pct = (filled / total * 100) if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {field:20s} {filled:3d}/{total:3d} ({pct:5.1f}%) {bar}")

    return True


def test_with_file(filepath: str):
    """Load raw events from a JSON file and test normalization."""
    with open(filepath) as f:
        raw_events = json.load(f)
    if isinstance(raw_events, dict):
        raw_events = raw_events.get("events", raw_events.get("data", [raw_events]))

    print(f"Loaded {len(raw_events)} events from {filepath}")

    results = [_normalize_audit_event(raw) for raw in raw_events if isinstance(raw, dict)]

    # Per-event detail for first 5
    for i, (raw, result) in enumerate(zip(raw_events[:5], results[:5])):
        print(f"\n{'─'*60}")
        print(f"Event {i+1}: {result.get('event', '?')}")
        print(f"{'─'*60}")
        for field in FIELDS_TO_CHECK:
            val = result.get(field)
            filled = val not in (None, "", "Unknown")
            marker = "✓" if filled else "⊘"
            print(f"  {marker} {field:20s} = {val!r}")
        meta = result.get("metadata", {})
        if meta:
            print(f"  ── raw metadata keys: {list(meta.keys())[:20]}")

    # Summary
    total = len(results)
    print(f"\n{'='*60}")
    print(f"COVERAGE SUMMARY ({total} events)")
    print(f"{'='*60}")
    for field in FIELDS_TO_CHECK:
        filled = sum(1 for r in results if r.get(field) not in (None, "", "Unknown"))
        pct = (filled / total * 100) if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {field:20s} {filled:3d}/{total:3d} ({pct:5.1f}%) {bar}")


if __name__ == "__main__":
    print("=" * 60)
    print("AUDIT EVENT NORMALIZATION TEST SUITE")
    print("=" * 60)

    # Always run mock tests first
    print("\n▶ Running mock data tests...")
    mock_ok = run_mock_tests()

    print(f"\n\n{'='*60}")
    print(f"MOCK TESTS: {'ALL PASSED ✓' if mock_ok else 'SOME FAILED ✗'}")
    print(f"{'='*60}")

    # Optional: test against live app or file
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--file" and len(sys.argv) > 2:
            print(f"\n▶ Testing with file: {sys.argv[2]}")
            test_with_file(sys.argv[2])
        elif arg.startswith("http"):
            print(f"\n▶ Testing with live app: {arg}")
            test_with_live_data(arg)
        else:
            print(f"\nUsage: python {sys.argv[0]} [APP_URL | --file PATH]")
    else:
        print("\nTip: Run with APP_URL to test against live data:")
        print(f"  python {sys.argv[0]} https://your-app.domino.tech")
