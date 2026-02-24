#!/usr/bin/env python3
"""
Fetch raw audit trail events from Domino API and analyze their structure.

Usage:
  # With API key:
  python fetch_and_analyze_audit.py --hostname https://your-domino.com --api-key YOUR_KEY

  # With JWT:
  python fetch_and_analyze_audit.py --hostname https://your-domino.com --jwt YOUR_JWT

  # With env vars (DOMINO_HOSTNAME + DOMINO_USER_API_KEY or JWT):
  export DOMINO_HOSTNAME=https://your-domino.com
  export DOMINO_USER_API_KEY=your-key
  python fetch_and_analyze_audit.py

  # Inside a running Domino app (uses localhost:8899 for token):
  python fetch_and_analyze_audit.py --hostname $DOMINO_API_HOST --use-token-endpoint
"""
import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path

import requests

# Try to import our normalizer
try:
    sys.path.insert(0, str(Path(__file__).parent))
    from app import _normalize_audit_event
    HAS_NORMALIZER = True
except Exception:
    HAS_NORMALIZER = False

AUDIT_PATHS = [
    "/api/audittrail/v1/auditevents",
    "/auditevents",
    "/v4/auditevents",
]

FIELDS_TO_CHECK = [
    "command", "status", "hardwareTier", "environmentName", "runId",
    "durationSec", "computeTier", "runType", "runFile", "runOrigin",
    "actorName", "withinProjectName", "jobId",
]


def get_auth_headers(args):
    if args.api_key:
        return {"X-Domino-Api-Key": args.api_key}
    if args.jwt:
        jwt = args.jwt
        if not jwt.startswith("Bearer "):
            jwt = f"Bearer {jwt}"
        return {"Authorization": jwt}
    if args.use_token_endpoint:
        try:
            resp = requests.get("http://localhost:8899/access-token", timeout=5)
            token = resp.text.strip()
            if token.startswith("Bearer "):
                return {"Authorization": token}
            return {"Authorization": f"Bearer {token}"}
        except Exception as e:
            print(f"ERROR: Could not get token from localhost:8899: {e}")
            sys.exit(1)

    env_key = os.environ.get("DOMINO_USER_API_KEY")
    if env_key:
        return {"X-Domino-Api-Key": env_key}
    env_jwt = os.environ.get("JWT")
    if env_jwt:
        return {"Authorization": f"Bearer {env_jwt}"}
    print("ERROR: No auth provided. Use --api-key, --jwt, --use-token-endpoint, or set DOMINO_USER_API_KEY env var.")
    sys.exit(1)


def fetch_events(hostname, headers, limit=50):
    hostname = hostname.rstrip("/")
    for path in AUDIT_PATHS:
        url = f"{hostname}{path}"
        print(f"  Trying: {url} ...")
        try:
            resp = requests.get(url, params={"limit": str(limit)}, headers=headers, timeout=30)
            if resp.ok:
                data = resp.json()
                if isinstance(data, list):
                    print(f"  ✓ Got {len(data)} events (list response)")
                    return data
                if isinstance(data, dict):
                    for key in ["events", "data", "items", "results", "auditEvents"]:
                        if key in data and isinstance(data[key], list):
                            events = data[key]
                            print(f"  ✓ Got {len(events)} events (from response.{key})")
                            return events
                    if "id" in data or "timestamp" in data:
                        print(f"  ✓ Got 1 event (single object)")
                        return [data]
                    print(f"  ? Response is dict with keys: {list(data.keys())[:10]}")
                    # Dump first 500 chars for debugging
                    print(f"  ? First 500 chars: {json.dumps(data, default=str)[:500]}")
                    return []
            else:
                print(f"  ✗ {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"  ✗ Error: {e}")
    return []


def analyze_structure(events):
    """Deep-analyze the structure of raw audit events."""
    print(f"\n{'='*70}")
    print(f"STRUCTURE ANALYSIS ({len(events)} events)")
    print(f"{'='*70}")

    # Top-level keys across all events
    all_keys = Counter()
    for ev in events:
        if isinstance(ev, dict):
            for k in ev.keys():
                all_keys[k] += 1

    print(f"\nTop-level keys (across {len(events)} events):")
    for key, count in all_keys.most_common():
        print(f"  {key:30s} {count:4d}/{len(events)}")

    # Targets structure
    print(f"\n--- targets[] structure ---")
    target_keys = Counter()
    entity_keys = Counter()
    for ev in events:
        targets = ev.get("targets", [])
        if isinstance(targets, list):
            for t in targets:
                if isinstance(t, dict):
                    for k in t.keys():
                        target_keys[k] += 1
                    ent = t.get("entity", {})
                    if isinstance(ent, dict):
                        for k in ent.keys():
                            entity_keys[k] += 1
    if target_keys:
        print(f"  targets[*] keys:")
        for key, count in target_keys.most_common():
            print(f"    {key:30s} {count:4d}")
    if entity_keys:
        print(f"  targets[*].entity keys:")
        for key, count in entity_keys.most_common():
            print(f"    {key:30s} {count:4d}")

    # Metadata structure
    print(f"\n--- metadata keys ---")
    meta_keys = Counter()
    meta_types = {}
    for ev in events:
        meta = ev.get("metadata")
        if isinstance(meta, dict):
            for k, v in meta.items():
                meta_keys[k] += 1
                vtype = type(v).__name__
                if k not in meta_types:
                    meta_types[k] = Counter()
                meta_types[k][vtype] += 1

    if meta_keys:
        print(f"  metadata keys (showing all):")
        for key, count in meta_keys.most_common():
            types_str = ", ".join(f"{t}:{c}" for t, c in meta_types[key].most_common(3))
            print(f"    {key:40s} {count:4d}/{len(events)}  types: {types_str}")
    else:
        print("  (no metadata dict found in any event)")

    # Check customAttributes and other locations
    for location in ["customAttributes", "attributes", "properties"]:
        found_in_target = 0
        found_in_entity = 0
        sample_keys = set()
        for ev in events:
            targets = ev.get("targets", [])
            if isinstance(targets, list):
                for t in targets:
                    if isinstance(t, dict):
                        val = t.get(location)
                        if val is not None:
                            found_in_target += 1
                            if isinstance(val, dict):
                                sample_keys.update(val.keys())
                            elif isinstance(val, list) and val:
                                for item in val[:5]:
                                    if isinstance(item, dict):
                                        sample_keys.update(item.keys())
                        ent = t.get("entity", {})
                        if isinstance(ent, dict):
                            val2 = ent.get(location)
                            if val2 is not None:
                                found_in_entity += 1
                                if isinstance(val2, dict):
                                    sample_keys.update(val2.keys())
        if found_in_target or found_in_entity:
            print(f"\n  ★ Found '{location}' in targets: {found_in_target}, in entity: {found_in_entity}")
            if sample_keys:
                print(f"    Sample keys: {list(sample_keys)[:20]}")


def dump_sample_events(events, count=3):
    """Dump raw JSON of a few events for manual inspection."""
    print(f"\n{'='*70}")
    print(f"RAW EVENT SAMPLES (first {min(count, len(events))})")
    print(f"{'='*70}")

    for i, ev in enumerate(events[:count]):
        print(f"\n--- Event {i+1} ---")
        print(json.dumps(ev, indent=2, default=str)[:3000])
        if len(json.dumps(ev, default=str)) > 3000:
            print("  ... (truncated)")


def test_normalization(events):
    """Run our normalization on real events and show coverage."""
    if not HAS_NORMALIZER:
        print("\n(Skipping normalization test - could not import app._normalize_audit_event)")
        return

    print(f"\n{'='*70}")
    print(f"NORMALIZATION TEST ({len(events)} events)")
    print(f"{'='*70}")

    results = []
    for ev in events:
        if isinstance(ev, dict):
            try:
                results.append(_normalize_audit_event(ev))
            except Exception as e:
                print(f"  ERROR normalizing event: {e}")

    # Show first 5 events detail
    for i, result in enumerate(results[:5]):
        print(f"\n  Event {i+1}: {result.get('event', '?')} | target={result.get('targetType', '?')}")
        for field in FIELDS_TO_CHECK:
            val = result.get(field)
            filled = val not in (None, "", "Unknown")
            marker = "✓" if filled else "⊘"
            display = repr(val)[:60] if val else "(empty)"
            print(f"    {marker} {field:20s} = {display}")

    # Coverage summary
    total = len(results)
    print(f"\n{'─'*60}")
    print(f"COVERAGE SUMMARY ({total} events)")
    print(f"{'─'*60}")
    for field in FIELDS_TO_CHECK:
        filled = sum(1 for r in results if r.get(field) not in (None, "", "Unknown"))
        pct = (filled / total * 100) if total else 0
        bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
        print(f"  {field:20s} {filled:4d}/{total:4d} ({pct:5.1f}%) {bar}")


def save_raw_events(events, filepath="raw_audit_events.json"):
    """Save raw events to file for offline analysis."""
    with open(filepath, "w") as f:
        json.dump(events, f, indent=2, default=str)
    print(f"\n✓ Saved {len(events)} raw events to {filepath}")


def main():
    parser = argparse.ArgumentParser(description="Fetch and analyze Domino audit trail events")
    parser.add_argument("--hostname", default=os.environ.get("DOMINO_HOSTNAME") or os.environ.get("DOMINO_API_HOST", ""),
                        help="Domino hostname (e.g. https://your-domino.com)")
    parser.add_argument("--api-key", default=None, help="Domino API key")
    parser.add_argument("--jwt", default=None, help="JWT token")
    parser.add_argument("--use-token-endpoint", action="store_true", help="Use localhost:8899/access-token")
    parser.add_argument("--limit", type=int, default=50, help="Number of events to fetch (default: 50)")
    parser.add_argument("--save", default="raw_audit_events.json", help="Save raw events to file")
    parser.add_argument("--no-save", action="store_true", help="Don't save raw events")
    args = parser.parse_args()

    if not args.hostname:
        print("ERROR: --hostname required (or set DOMINO_HOSTNAME env var)")
        parser.print_help()
        sys.exit(1)

    print(f"Domino hostname: {args.hostname}")
    print(f"Fetching up to {args.limit} events...\n")

    headers = get_auth_headers(args)
    events = fetch_events(args.hostname, headers, limit=args.limit)

    if not events:
        print("\nNo events fetched. Check hostname and credentials.")
        sys.exit(1)

    # Save raw events for offline analysis
    if not args.no_save:
        save_raw_events(events, args.save)

    # Analyze structure
    analyze_structure(events)

    # Dump samples
    dump_sample_events(events, count=3)

    # Test normalization
    test_normalization(events)

    print(f"\n{'='*70}")
    print("DONE. Review the output above to see:")
    print("  1. What keys are in the raw events (especially metadata)")
    print("  2. Whether customAttributes exists on targets")
    print("  3. How our normalization extracts each field")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
