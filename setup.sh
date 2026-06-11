#!/bin/bash
set -e

echo "=== SoloRMT Setup ==="
echo ""

# ── Homebrew ────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "→ Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon Macs
  eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
else
  echo "✓ Homebrew already installed"
fi

# ── Docker Desktop ───────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "→ Installing Docker Desktop..."
  brew install --cask docker
  echo ""
  echo "  ⚠️  Docker Desktop was just installed."
  echo "  Please open Docker from your Applications folder and let it finish starting up."
  echo "  Then re-run this script to continue."
  echo ""
  open /Applications/Docker.app 2>/dev/null || true
  exit 0
else
  echo "✓ Docker already installed"
fi

# Check Docker daemon is actually running
if ! docker info &>/dev/null; then
  echo ""
  echo "  ⚠️  Docker is installed but not running."
  echo "  Open Docker Desktop from your Applications folder, wait for it to start, then re-run this script."
  open /Applications/Docker.app 2>/dev/null || true
  exit 1
fi

# ── Node.js ──────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "→ Installing Node.js..."
  brew install node
else
  echo "✓ Node.js $(node --version) already installed"
fi

# ── Python 3.12 ──────────────────────────────────────────────────────────────
if ! command -v python3.12 &>/dev/null; then
  echo "→ Installing Python 3.12..."
  brew install python@3.12
else
  echo "✓ Python 3.12 already installed"
fi

# ── Backend Python deps ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

echo "→ Setting up Python virtual environment..."
cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
  python3.12 -m venv .venv
fi

source .venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✓ Backend Python dependencies installed"

# ── Backend .env ──────────────────────────────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "→ Creating backend .env from example..."
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  echo "✓ Created backend/.env — open it and fill in your secrets if needed"
else
  echo "✓ backend/.env already exists"
fi

# ── Frontend Node deps ────────────────────────────────────────────────────────
FRONTEND_DIR="$SCRIPT_DIR/frontend"
echo "→ Installing frontend Node.js dependencies..."
cd "$FRONTEND_DIR"
npm install --silent
echo "✓ Frontend dependencies installed"

# ── Frontend .env.local ───────────────────────────────────────────────────────
if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
  echo "NEXT_PUBLIC_API_URL=/api/proxy" > "$FRONTEND_DIR/.env.local"
  echo "✓ Created frontend/.env.local"
else
  echo "✓ frontend/.env.local already exists"
fi

# ── Start database ────────────────────────────────────────────────────────────
echo "→ Starting PostgreSQL database..."
cd "$SCRIPT_DIR"
docker compose up -d
echo "✓ Database running"

# ── Run migrations ────────────────────────────────────────────────────────────
echo "→ Running database migrations..."
cd "$BACKEND_DIR"
source .venv/bin/activate
python manage.py migrate --run-syncdb 2>/dev/null || python manage.py migrate
echo "✓ Database migrations complete"

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "✅ Setup complete! To start the app:"
echo ""
echo "   Backend:  cd backend && source .venv/bin/activate && python manage.py runserver"
echo "   Frontend: cd frontend && npm run dev"
echo ""
echo "   Then open http://localhost:3000"
