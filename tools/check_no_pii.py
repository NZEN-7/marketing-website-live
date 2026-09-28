#!/usr/bin/env python3
"""
Guard for Tech Ops review decision 3 (21 Sep 2026): no customer identity in this repo.

Ported to marketing-website from energy-model (tools/check_no_pii.py, 26 Sep
2026). The digest list is energy-model's, unchanged, so a name watched there is
watched here. What is retuned for a website, and why, is marked PORT below.

The Drive customer folder is canonical for anything with a name in it. Test
fixtures here use made-up identities on example.com; a real lead's name, email
or phone never goes in, even to reproduce a real email's layout.

    python tools/check_no_pii.py             # scan tracked files, exit 1 on a hit
    python tools/check_no_pii.py --all       # scan the working tree too
    python tools/check_no_pii.py --add NAME  # print the digest for a new surname

WHY THE NAMES ARE HASHED. This guard needs to know the surnames it is hunting,
which made an earlier version the last file in the repo still carrying customer
names - and a history rewrite then mangled its own pattern list. Loading them
from the CRM instead was worse: ordinary English words like "button" are real
surnames, and the false positives buried the true ones.

So the surnames are stored as truncated SHA-256 digests. The file names nobody,
the check is an exact token match so it never fires on prose, and adding a
customer is one line from `--add`.

SCOPE. This checks customer IDENTITY. It does NOT flag `device_id` values,
which are street addresses but are also the firmware's installation identifier,
carried in `live_unit_telemetry.device_id` and used to join telemetry across
four repos. Renaming them is a cross-repo decision for the CTO, not one
energy-model can make alone. See energy-model docs/decision-3-pii.md.
"""
from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SALT = "thermal-dawn-pii-guard-v1"


def digest(word: str) -> str:
    return hashlib.sha256((SALT + word.strip().lower()).encode()).hexdigest()[:12]


# Truncated SHA-256 of each surname and given name we must not ship.
# Add with:  python tools/check_no_pii.py --add Surname
WATCHED = {
    "013000a4d2c3", "01b8c5ce57bb", "0347da4ab64f", "0412a33efe64",
    "043ec7342484", "0aefea2d067a", "12c4fae82b1d", "1320966c7cd6",
    "1475161dca21", "1a6150255e2b", "20774db752da", "2226a5ef0804",
    "26f7d3881b54", "313a56d09f78", "317c61f3fe55", "3182f5e15fda",
    "36b25c2dee1d", "371c8e4fa641", "37fae6ee38e7", "383dcf35a9f4",
    "387764b82516", "39491968e296", "3f52e7bef179", "40eb610d44da",
    "4c41a6045097", "4ed3ae23b538", "5073f72476ee", "57732f53dd6a",
    "58f0f9525500", "5d70b523498f", "61b0f8d18c8b", "6277b9db75f2",
    "6436b2196e4f", "656d886e7462", "686e9577f549", "6bcaeb61851e",
    "6bfe8a05e868", "783307002fab", "7d9be1709f7c", "823d1eb70685",
    "8389dd1b7939", "8e13294f8874", "8e8a71214174",
    "907e34ac1578", "9151b17c1c10", "942d5a9e3192", "96e677a9be21",
    "9a9e5a3d3fed", "9cb369b20ba7", "9d8aba424695", "9ed0ba38004d",
    "a2f5a7ff43dc", "a5b54207327a", "a75bb5532ce4", "ad23d02e465d",
    "adccd1d7c629", "ae899dc6cc1f", "b2370fd7973f", "b27aaa15ddc9",
    "b7cf1bb43905", "b85ce968136b", "bb85938b969a", "bbd97b1d26f0",
    "bec247ab5c29", "bf05acad33e1", "c4648b7bf3bf", "c7e9400dd523",
    "cb25ecd5fc6f", "cdb7758d1d06", "d03edcb4c422", "d13e9e93dbf8",
    "d239caaeae45", "d6d838d2d325", "dd1c52ff628e", "e113a4799fff",
    "e2d866e23a60", "e333b8b6c54c", "e33a9c64010a", "e383ac7d53b3",
    "e475717db47f", "e5799e5c1f0b", "e85bd9780843", "e9b04468bef3",
    "ea837568380e", "eac8e5cd8911", "ebb03b171b79", "ec0fe0093e1b",
    "ec33602a2641", "ef0ea88a7fb5", "f2cb8b4fdd65", "fcfddb369c41",
    "ffccb3b2bafe",
    # 25 Sep 2026: five names the list was missing
    "f283041502eb", "7903d3b0c458", "2f3ac204d5c7", "82c6c8df9491", "604df39407ce",
}

# Structural patterns. These carry identity without naming anyone, so they are
# safe to keep readable. No street-address pattern: it fired on our own device
# ids ("7 Mason St", "159 Rulemount Rd"), which are out of scope by design.
STRUCTURAL = [
    (r"Sales \+[/\\]Consumer[/\\]Customers", "absolute path into the Drive customer folder"),
    # PORT: our own mailboxes (thermaldawn.com, the old freevolt.com.au) are on
    # every page and in the lead pipeline; they are not customer identity.
    (r"[\w.+-]+@(?!noreply|example|thermaldawn\.com|freevolt\.com\.au)[\w-]+\.(?:com|com\.au|net|org)(?:\.au)?\b",
     "email address"),
    # PORT: the lead fixtures hold phones in +61 form, which the energy-model
    # pattern missed. The all-zero 0400 000 0xx / +61 400 000 0xx range is the
    # fixtures' placeholder and is not a real service number. The company's
    # own published mobile (in the autoresponder and the forms spec) is ours,
    # not a customer's, so it is excepted by number.
    (r"\b0[45](?!00[\s-]?000[\s-]?0|32[\s-]?395[\s-]?138)\d{2}[\s-]?\d{3}[\s-]?\d{3}\b", "mobile number"),
    (r"\+61[\s-]?4(?!00[\s-]?000[\s-]?0|32[\s-]?395[\s-]?138)\d{2}[\s-]?\d{3}[\s-]?\d{3}\b", "mobile number"),
]

# PORT: tokens that collide with a watched digest but are, on this site, public
# names: a partner organisation ("Investment NSW") and a council whose events
# we present at ("Electrify Boroondara"). Each is a named exception, not a
# loosening of the list.
PUBLIC_WORDS = {"investment", "boroondara"}

COMPILED = [(re.compile(p, re.I), why) for p, why in STRUCTURAL]

TOKEN = re.compile(r"[A-Za-z]{4,}")
SCAN_SUFFIXES = {".py", ".mjs", ".js", ".ts", ".json", ".md", ".yaml", ".yml",
                 ".csv", ".html", ".txt", ".sh",
                 ".gs", ".toml"}  # .gs: the Apps Script files (Platform review, 28 Sep)
SKIP_DIRS = {".git", "node_modules", "__pycache__", "_scratchpad-rescue-2026-08-13"}


def tracked_files(root: Path) -> list[Path]:
    r = subprocess.run(["git", "ls-files", "-z"], capture_output=True, cwd=root)
    return [root / p for p in r.stdout.decode("utf-8").split("\0") if p]


def all_files(root: Path) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and not SKIP_DIRS & set(p.parts)]


def is_watched(tok: str) -> bool:
    return tok.lower() not in PUBLIC_WORDS and digest(tok) in WATCHED


def scan(paths: list[Path], root: Path) -> list[tuple[str, int, str, str]]:
    hits = []
    for p in paths:
        try:
            rel = p.relative_to(root).as_posix()
        except ValueError:
            continue
        if p.suffix.lower() not in SCAN_SUFFIXES or not p.exists():
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        # a path can carry a name even when the contents do not
        for tok in TOKEN.findall(rel):
            if is_watched(tok):
                hits.append((rel, 0, "customer name in the file path", rel))
                break
        for i, line in enumerate(text.splitlines(), 1):
            why = None
            for tok in TOKEN.findall(line):
                if is_watched(tok):
                    why = "customer name"
                    break
            if why is None:
                for rx, w in COMPILED:
                    if rx.search(line):
                        why = w
                        break
            if why:
                hits.append((rel, i, why, line.strip()[:90]))
    return hits


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--all", action="store_true",
                    help="scan the whole working tree, not just git-tracked files")
    ap.add_argument("--add", metavar="NAME", help="print the digest line for a new name")
    args = ap.parse_args()

    if args.add:
        print(f'    "{digest(args.add)}",   # add this line to WATCHED')
        return 0

    root = Path(__file__).resolve().parent.parent
    paths = all_files(root) if args.all else tracked_files(root)
    hits = scan(paths, root)
    where = "working-tree" if args.all else "tracked"

    if not hits:
        print(f"no customer identity found in {len(paths)} {where} files "
              f"({len(WATCHED)} names watched)")
        return 0

    print(f"CUSTOMER IDENTITY FOUND in {len({h[0] for h in hits})} file(s):\n")
    for rel, i, why, line in hits:
        print(f"  {rel}:{i}  [{why}]")
        print(f"    {line}")
    print("\nThis repo is keyed by TD ref only (Tech Ops review 21 Sep 2026, decision 3).")
    print("Names, addresses and contact details belong in the Drive customer folder;")
    print("the ref-to-person mapping lives in Sales +/CRM/contacts.csv.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
