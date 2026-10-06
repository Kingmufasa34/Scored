#!/usr/bin/env python3
"""PreToolUse hook: saved drafts are read-only.

Blocks Edit/Write on an existing drafts/draft-NN file, and Bash commands that
delete, move or rewrite one. New revisions go in the next numbered draft.
"""
import json
import os
import re
import sys

DRAFT = re.compile(r"(^|/)drafts/draft-\d+\.(fountain|pdf)$")
BASH_DRAFT = re.compile(r"drafts/draft-\d+\.(fountain|pdf)")
BASH_DESTRUCTIVE = re.compile(r"(\brm\b|\bmv\b|\bsed\s+-i|\btruncate\b|>\s*\S*drafts/draft-|\bgit\s+(checkout|restore)\b)")

MSG = ("Saved drafts are never changed. Copy the latest draft to the next number "
       "(e.g. draft-03.fountain -> draft-04.fountain), edit the copy, and add a line to drafts/HISTORY.md.")

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
inp = data.get("tool_input", {}) or {}

if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    path = inp.get("file_path", "")
    if DRAFT.search(path) and os.path.exists(path):
        print(f"Blocked: {path} is a saved draft. {MSG}", file=sys.stderr)
        sys.exit(2)
elif tool == "Bash":
    cmd = inp.get("command", "")
    if BASH_DRAFT.search(cmd) and BASH_DESTRUCTIVE.search(cmd):
        print(f"Blocked: this command would delete or change a saved draft. {MSG}", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
