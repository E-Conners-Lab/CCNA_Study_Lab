#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# CCNA StudyLab — Release Packager
#
# Creates a clean zip file for distribution, excluding secrets, dev artifacts,
# and unnecessary files. Run from the project root:
#
#   bash scripts/package-release.sh
#
# Output: CCNA_StudyLab_v<version>.zip in the project root
# ---------------------------------------------------------------------------

VERSION="${1:-1.0.0}"
PROJECT_NAME="CCNA_StudyLab"
OUTPUT_FILE="${PROJECT_NAME}_v${VERSION}.zip"
STAGING_DIR=$(mktemp -d)
DEST="${STAGING_DIR}/${PROJECT_NAME}"

echo "Packaging ${PROJECT_NAME} v${VERSION}..."
echo ""

# -- Copy project files to staging directory --------------------------------
mkdir -p "${DEST}"

# Use rsync to copy, excluding unwanted files
rsync -a --progress \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.git/**' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.development' \
  --exclude='.env.production' \
  --exclude='.env.*.local' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.venv' \
  --exclude='venv' \
  --exclude='*.egg-info' \
  --exclude='.coverage' \
  --exclude='coverage' \
  --exclude='playwright-report' \
  --exclude='test-results' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  --exclude='.idea' \
  --exclude='.vscode' \
  --exclude='.claude' \
  --exclude='CLAUDE.md' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='pgdata' \
  --exclude='docker/postgres/data' \
  --exclude='*.log' \
  --exclude='npm-debug.log*' \
  --exclude='*.pem' \
  --exclude='*.key' \
  --exclude='credentials.json' \
  --exclude='CONTRIBUTING.md' \
  ./ "${DEST}/"

# -- Verify no secrets leaked into the package ------------------------------
echo ""
echo "Scanning for leaked secrets..."

LEAKED=0
# Check for real Anthropic API keys (40+ chars after prefix), not placeholder text
if grep -rPq "sk-ant-api\d+-[A-Za-z0-9_-]{20,}" "${DEST}" --include='*.ts' --include='*.js' --include='*.json' --include='*.env*' 2>/dev/null; then
  echo "ERROR: Anthropic API key found in package!"
  LEAKED=1
fi

if grep -rq "CHANGE_ME" "${DEST}/apps/web/.env.example" 2>/dev/null; then
  : # This is expected in .env.example
else
  # Check for real passwords in .env.example
  if grep -q "studylab_dev_2024" "${DEST}/apps/web/.env.example" 2>/dev/null; then
    echo "WARNING: Default dev password found in .env.example (this is expected for setup)"
  fi
fi

if [ "$LEAKED" -eq 1 ]; then
  echo "ABORTING: Secret detected in release package. Fix before packaging."
  rm -rf "${STAGING_DIR}"
  exit 1
fi

echo "No leaked secrets found."

# -- Create the zip ---------------------------------------------------------
echo ""
echo "Creating ${OUTPUT_FILE}..."
cd "${STAGING_DIR}"
zip -r -q "${OLDPWD}/${OUTPUT_FILE}" "${PROJECT_NAME}"
cd "${OLDPWD}"

# -- Cleanup ----------------------------------------------------------------
rm -rf "${STAGING_DIR}"

SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo ""
echo "Done! Created ${OUTPUT_FILE} (${SIZE})"
echo ""
echo "Contents:"
echo "  - Source code (apps/web, services/lab-engine)"
echo "  - Content files (flashcards, exams, labs, study guides)"
echo "  - Docker configuration"
echo "  - Documentation (README, SETUP, docs/)"
echo "  - Install script (install.sh)"
echo ""
echo "Verify before distributing:"
echo "  1. Unzip to a temp directory"
echo "  2. Run: bash install.sh"
echo "  3. Confirm app starts at http://localhost:3000"
