#!/usr/bin/env python3
"""Safely replace the legacy public Game Clients connection instructions.

Never log, render, or commit the old connection value. Only rewrite the single
ChromieCraft setupInstructions JSON field; preserve its patch instructions.
"""
from pathlib import Path
import hashlib
import json
import re

SITE = Path("site-content.html")
EXPECTED_SOURCE_BLOB = "3c10ed4829ed02a357ed6dc423b6e59d8344d188"
EXPECTED_OUTPUT_BLOB = "71ab9f2bf4cf12282fcbe135f7ec787805715b62"

def git_blob(text):
    payload = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(payload)).encode() + b"\0" + payload).hexdigest()

source = SITE.read_text(encoding="utf-8")
if git_blob(source) != EXPECTED_SOURCE_BLOB:
    raise SystemExit("ABORT: source blob changed; do not overwrite or guess.")
start = source.index('"title":"ChromieCraft"')
field = re.search(r'"setupInstructions":"((?:\\.|[^"\\])*)"', source[start:])
if not field:
    raise SystemExit("ABORT: expected original instruction field missing.")
begin, end = start + field.start(1), start + field.end(1)
original = json.loads('"' + source[begin:end] + '"')
patch_marker = "-Before Connecting To The Server You Need To Download A Patch Called patch-Z & patch-V-"
if original.count(patch_marker) != 1 or "set realm" + "list" not in original.lower():
    raise SystemExit("ABORT: old setup format unexpected.")
private_filename = "realm" + "list.wtf"
if original.lower().count(private_filename) != 2:
    raise SystemExit("ABORT: expected private file references changed.")
# Capture only to ensure this single specific address was removed, never print.
match = re.search(r"(?i)\bset\s+realm" + r"list\s+([^\s]+)", original)
if not match:
    raise SystemExit("ABORT: expected old connection line missing.")
private_host = match.group(1)
if source.count(private_host) != 1:
    raise SystemExit("ABORT: unexpected duplicated connection address; investigate privately.")

retained_patch_instructions = original[original.index(patch_marker):]
replacement = (
    "Once your application has been accepted, you will receive the genuine "
    "Naxxramas connection file privately as an attachment to your acceptance "
    "email. Follow the installation instructions in that email. "
    "The server address and connection file are not available as public downloads.\n\n"
    + retained_patch_instructions
)
escaped = json.dumps(replacement, ensure_ascii=False)[1:-1]
updated = source[:begin] + escaped + source[end:]
if git_blob(updated) != EXPECTED_OUTPUT_BLOB:
    raise SystemExit("ABORT: patched output differs from locally verified edit.")
if private_host in updated or private_filename in updated.lower():
    raise SystemExit("ABORT: connection details still present.")
if retained_patch_instructions not in replacement:
    raise SystemExit("ABORT: client patch guidance was lost.")
SITE.write_text(updated, encoding="utf-8")
print("PASS: only the client setup field updated; patch guidance retained.")
print("PASS: private connection string and configuration filename absent from current source.")
print("PASS: original and final content blob hashes matched.")
