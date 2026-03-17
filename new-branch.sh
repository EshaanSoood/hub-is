#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <new-branch-name>" >&2
  exit 1
fi

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
branch_name="$1"

cd "$repo_dir"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: $repo_dir is not a Git repository." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: uncommitted changes detected in $repo_dir. Commit or stash them before creating a new branch." >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  echo "Error: local branch '$branch_name' already exists." >&2
  exit 1
fi

git fetch origin --prune
git checkout -b "$branch_name" origin/main
