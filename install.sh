#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# CCNA StudyLab — Installer
#
# Automated setup for a fresh download. Checks prerequisites, installs
# dependencies, configures the database, and starts the application.
#
# Usage:
#   bash install.sh              # Interactive setup
#   bash install.sh --no-start   # Install only, don't start the server
# ---------------------------------------------------------------------------

# -- Colors & helpers -------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail()    { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

NO_START=false
for arg in "$@"; do
  case "$arg" in
    --no-start) NO_START=true ;;
  esac
done

# -- Banner -----------------------------------------------------------------
echo ""
echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  CCNA StudyLab — Installer${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""

# -- Check prerequisites ----------------------------------------------------
info "Checking prerequisites..."

# Node.js
if ! command -v node &>/dev/null; then
  fail "Node.js is not installed. Install Node.js 20+ from https://nodejs.org/"
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  fail "Node.js 20+ required (found v$(node -v)). Update at https://nodejs.org/"
fi
success "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm is not installed."
fi
success "npm $(npm -v)"

# Docker
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
fi
success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# Docker Compose
if docker compose version &>/dev/null; then
  success "Docker Compose $(docker compose version --short)"
else
  fail "Docker Compose is not available. Update Docker Desktop."
fi

# Check Docker is running
if ! docker info &>/dev/null 2>&1; then
  fail "Docker is installed but not running. Start Docker Desktop and try again."
fi
success "Docker daemon is running"

echo ""

# -- Install Node.js dependencies -------------------------------------------
info "Installing Node.js dependencies..."

# Root workspace
if [ -f "package.json" ]; then
  npm install --silent 2>/dev/null || npm install
fi

# Web app
cd apps/web
npm install --silent 2>/dev/null || npm install
cd ../..

success "Dependencies installed"
echo ""

# -- Start PostgreSQL --------------------------------------------------------
info "Starting PostgreSQL via Docker..."

docker compose -f docker/docker-compose.yml up -d postgres

# Wait for PostgreSQL to be ready
info "Waiting for PostgreSQL to be ready..."
RETRIES=30
until docker compose -f docker/docker-compose.yml exec -T postgres pg_isready -U studylab -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    fail "PostgreSQL did not become ready in time. Check Docker logs: docker compose -f docker/docker-compose.yml logs postgres"
  fi
  sleep 1
done

success "PostgreSQL is ready"
echo ""

# -- Configure environment ---------------------------------------------------
ENV_FILE="apps/web/.env.local"

if [ -f "$ENV_FILE" ]; then
  warn ".env.local already exists — skipping configuration"
  info "Edit $ENV_FILE manually if you need to change settings"
else
  info "Configuring environment..."

  # Generate AUTH_SECRET
  AUTH_SECRET=$(openssl rand -base64 32)

  # Create .env.local from example
  cp apps/web/.env.example "$ENV_FILE"

  # Replace the placeholder AUTH_SECRET
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|AUTH_SECRET=CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32|AUTH_SECRET=${AUTH_SECRET}|" "$ENV_FILE"
  else
    sed -i "s|AUTH_SECRET=CHANGE_ME_GENERATE_WITH_openssl_rand_base64_32|AUTH_SECRET=${AUTH_SECRET}|" "$ENV_FILE"
  fi

  success "Environment configured (AUTH_SECRET auto-generated)"
  echo ""

  # Prompt for optional Anthropic key
  echo -e "${YELLOW}Optional:${NC} The AI Tutor feature requires an Anthropic API key."
  echo "  Get one at: https://console.anthropic.com/"
  echo ""
  read -r -p "  Enter your Anthropic API key (or press Enter to skip): " ANTHROPIC_KEY

  if [ -n "$ANTHROPIC_KEY" ]; then
    # Uncomment and set the key
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|# TUTOR_ANTHROPIC_KEY=sk-ant-api03-...|TUTOR_ANTHROPIC_KEY=${ANTHROPIC_KEY}|" "$ENV_FILE"
    else
      sed -i "s|# TUTOR_ANTHROPIC_KEY=sk-ant-api03-...|TUTOR_ANTHROPIC_KEY=${ANTHROPIC_KEY}|" "$ENV_FILE"
    fi
    success "Anthropic API key configured"
  else
    info "Skipped — AI Tutor will show setup instructions when accessed"
  fi
fi

echo ""

# -- Initialize database -----------------------------------------------------
info "Setting up database schema..."
cd apps/web

npx drizzle-kit push 2>/dev/null || npx drizzle-kit push
success "Database schema created"

info "Seeding content (flashcards, exams, labs, study guides)..."
npm run db:seed
success "Database seeded"

cd ../..
echo ""

# -- Optional: Start lab engine -----------------------------------------------
echo -e "${YELLOW}Optional:${NC} The Lab Engine enables Python code execution for labs."
read -r -p "  Start the Lab Engine Docker service? (y/N): " START_ENGINE

if [[ "$START_ENGINE" =~ ^[Yy]$ ]]; then
  info "Building and starting lab engine..."
  # Set APP_ENV to development so the engine doesn't require an API key
  APP_ENV=development docker compose -f docker/docker-compose.yml up -d lab-engine

  # Add LAB_ENGINE_URL to .env.local if not already set
  if ! grep -q "^LAB_ENGINE_URL=" "$ENV_FILE" 2>/dev/null; then
    echo "" >> "$ENV_FILE"
    echo "LAB_ENGINE_URL=http://localhost:8100/api/v1/grade" >> "$ENV_FILE"
  fi
  success "Lab engine started"
fi

echo ""

# -- Summary ------------------------------------------------------------------
echo -e "${BOLD}======================================${NC}"
echo -e "${BOLD}  Installation Complete!${NC}"
echo -e "${BOLD}======================================${NC}"
echo ""
echo "  What was set up:"
echo "    - Node.js dependencies installed"
echo "    - PostgreSQL running on port 5433"
echo "    - Database schema created and seeded"
echo "    - Environment configured in apps/web/.env.local"
if [[ "${START_ENGINE:-}" =~ ^[Yy]$ ]]; then
echo "    - Lab Engine running on port 8100"
fi
echo ""
echo "  Default login credentials:"
echo "    Email:    student@ccna.lab"
echo "    Password: ccna123"
echo ""

if [ "$NO_START" = true ]; then
  echo "  To start the app later:"
  echo "    cd apps/web && npm run dev"
  echo ""
  echo "  Then open: http://localhost:3000"
else
  echo "  Starting the development server..."
  echo "  The app will be available at: http://localhost:3000"
  echo ""
  echo -e "  Press ${BOLD}Ctrl+C${NC} to stop the server."
  echo ""
  cd apps/web
  npm run dev
fi
