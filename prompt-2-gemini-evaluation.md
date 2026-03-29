# Codex Prompt: Gemini Visual Evaluation Script + Orchestrator

## Context

We have a Playwright verification suite at `e2e/project-verification/` that captures screenshots of every Hub OS project space surface at three viewports (desktop 1280×800, tablet 768×1024, mobile 375×812). After the screenshots are captured, we need an automated visual review pipeline that sends each screenshot to the Gemini CLI for layout evaluation and writes all results into a single markdown report.

Read the Playwright config at `e2e/project-verification/playwright.config.ts` to understand where screenshots are saved (should be `e2e/project-verification/screenshots/`).

## Files to Create

All files go in `e2e/project-verification/`:

```
e2e/project-verification/
  evaluate-screenshots.mjs    — Node script that calls Gemini CLI for each screenshot
  run-verification.sh          — Orchestrator shell script that runs the full pipeline
```

The script will produce:

```
e2e/project-verification/
  visual-evaluation.md         — created at runtime by evaluate-screenshots.mjs
```

## Gemini Evaluation Script (`evaluate-screenshots.mjs`)

A Node.js ESM script (no TypeScript, no build step needed — runs directly with `node`).

### Behavior

1. **Find all screenshots**: Read the `e2e/project-verification/screenshots/` directory. Collect all `.png` files. Sort them alphabetically so the report is ordered by phase.

2. **Group by phase**: Parse the filename pattern `{phaseNumber}-{phaseName}-{checkName}-{viewport}.png` and group screenshots by phase number.

3. **For each screenshot**, call the Gemini CLI to get a layout evaluation. The command to invoke is:

   ```
   gemini -m gemini-2.5-flash < prompt_with_image
   ```

   However, the Gemini CLI accepts images via file path. Check the Gemini CLI's actual invocation method by running `gemini --help` first. If it accepts a prompt with an image file reference, use that. The most common pattern is:

   ```
   cat image.png | gemini "prompt text"
   ```

   or:

   ```
   gemini -f image.png "prompt text"
   ```

   Use whichever method the CLI supports. If the CLI doesn't support direct image input, use the Gemini API via Node's `fetch` instead — the endpoint is `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` with the API key from the `GEMINI_API_KEY` environment variable. Send the image as base64 in the request body.

   **The prompt to send with each image:**

   ```
   You are evaluating a screenshot of a web application for layout and visual correctness. The app is Hub OS, a productivity platform. This screenshot was captured during automated testing.

   Focus ONLY on layout and visual issues. Evaluate:

   1. OVERLAP: Are any elements overlapping that shouldn't be? Text over text, buttons over content, panels covering other panels?
   2. ALIGNMENT: Are elements properly aligned? Headers centered or left-aligned consistently? Columns lined up? Consistent margins?
   3. SPACING: Is spacing consistent and reasonable? Are there areas with too much or too little whitespace? Cramped elements?
   4. TRUNCATION: Is any text cut off, truncated without ellipsis, or overflowing its container?
   5. EMPTY STATES: Are there any suspiciously blank areas where content should be? Missing icons? Invisible text (white on white)?
   6. RESPONSIVENESS: Does the layout look appropriate for the viewport size? (The viewport is indicated in the filename.)
   7. BROKEN RENDERING: Any obviously broken visual elements — missing borders, collapsed containers, elements rendering at 0 height/width?

   Rate the screenshot as one of:
   - PASS: No layout issues detected
   - WARN: Minor cosmetic issues that don't block functionality
   - FAIL: Significant layout problems that would affect usability

   Format your response as:
   RATING: [PASS|WARN|FAIL]
   ISSUES: [bulleted list of specific issues found, or "None" if PASS]
   DESCRIPTION: [2-3 sentence factual description of what the screenshot shows]
   ```

4. **Rate limiting**: Add a 2-second delay between Gemini calls to avoid rate limits on the free tier.

5. **Error handling**: If a Gemini call fails (timeout, rate limit, network error), log the error, mark that screenshot as `ERROR` in the report, and continue to the next one. Do not abort the whole run.

6. **Write the report**: Output a markdown file at `e2e/project-verification/visual-evaluation.md` with this structure:

   ```markdown
   # Visual Evaluation Report

   Generated: {ISO timestamp}
   Total screenshots: {count}
   Summary: {X} PASS, {Y} WARN, {Z} FAIL, {W} ERROR

   ---

   ## Phase 1 — Shell & Navigation

   ### 01-shell-{check}-desktop.png
   **Rating:** PASS
   **Issues:** None
   **Description:** The project space shell renders with three navigation tabs...

   ### 01-shell-{check}-tablet.png
   ...

   ---

   ## Phase 2 — Overview Tab
   ...
   ```

   Group screenshots under their phase heading. Within each phase, list screenshots in alphabetical order (which naturally groups by check name across viewports).

7. At the end of the script, print a one-line summary to stdout: `Visual evaluation complete: X PASS, Y WARN, Z FAIL, W ERROR. Report: e2e/project-verification/visual-evaluation.md`

## Orchestrator Shell Script (`run-verification.sh`)

A bash script that runs the full three-layer pipeline in sequence.

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Hub OS Project Space Verification Pipeline ==="
echo ""

# Step 0: Check prerequisites
echo "[0/3] Checking prerequisites..."

# Check that .env.users.local exists (needed for token minting)
if [ ! -f "$REPO_ROOT/e2e/.env.users.local" ]; then
  echo "ERROR: e2e/.env.users.local not found. Smoke user credentials required."
  exit 1
fi

# Check Gemini CLI is available
if ! command -v gemini &> /dev/null; then
  echo "WARNING: 'gemini' CLI not found. Visual evaluation step will attempt API fallback."
fi

echo "Prerequisites OK."
echo ""

# Step 1: Run Playwright verification suite
echo "[1/3] Running Playwright verification suite..."
echo "  This seeds test data via API, then walks all project space surfaces"
echo "  at desktop (1280x800), tablet (768x1024), and mobile (375x812) viewports."
echo ""

cd "$SCRIPT_DIR"
npx playwright test --config=playwright.config.ts

echo ""
echo "Playwright complete. Screenshots saved to: $SCRIPT_DIR/screenshots/"
echo ""

# Step 2: Run Gemini visual evaluation
echo "[2/3] Running Gemini visual evaluation on screenshots..."
echo ""

node "$SCRIPT_DIR/evaluate-screenshots.mjs"

echo ""

# Step 3: Print summary
echo "[3/3] Pipeline complete."
echo ""
echo "Outputs:"
echo "  Screenshots:       $SCRIPT_DIR/screenshots/"
echo "  Playwright report: $SCRIPT_DIR/report.json"
echo "  Visual evaluation: $SCRIPT_DIR/visual-evaluation.md"
echo ""
echo "Next steps:"
echo "  1. Review visual-evaluation.md for WARN/FAIL items"
echo "  2. Cross-reference any FAILs against report.json"
echo "  3. For items where Playwright PASSes but Gemini FAILs (or vice versa), manually verify once"
echo ""
```

Make the shell script executable (`chmod +x`).

## Important Constraints

- Do NOT modify any existing files. All new files go in `e2e/project-verification/`.
- `evaluate-screenshots.mjs` must be plain ESM JavaScript (not TypeScript) — it should run with just `node` without a build step.
- The Gemini prompt must be exactly as specified above — it's calibrated for layout evaluation, not general image description.
- The orchestrator must fail fast if Playwright fails (screenshots are needed for Gemini) but should still produce partial results if some Gemini calls fail.
- If the Gemini CLI is not available AND no `GEMINI_API_KEY` env var is set, `evaluate-screenshots.mjs` should print a clear error message and exit with code 1.

## Verification

```
npm run typecheck
npm run lint
npm run validate
npm run build
```
