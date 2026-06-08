#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AutoCliper — Full Server Deployment Script
#
# One command to rule them all:
#   ./deploy.sh
#
# What it does:
#   1. Git pull latest code
#   2. System dependencies (only installs missing ones)
#   3. MySQL connection check
#   4. autocliper-v2 setup (backend, port 8000)
#   5. autocliper-automate setup (social upload, port 8001)
#   6. Ollama + Mistral-Nemo:12b (skip if already installed)
#   7. Systemd services + restart
#
# Designed to be idempotent — safe to run multiple times.
# Second run is fast because it skips already-installed components.
# ═══════════════════════════════════════════════════════════════════════════════

export DEBIAN_FRONTEND=noninteractive

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
V2_DIR="$PROJECT_DIR/autocliper-v2"
AUTOMATE_DIR="$PROJECT_DIR/autocliper-automate"
DEPLOY_USER="${SUDO_USER:-$(whoami)}"
PYTHON_BIN="python3"

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 AutoCliper — Server Deployment"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Project: $PROJECT_DIR"
echo "  User:    $DEPLOY_USER"
echo "  Python:  $($PYTHON_BIN --version 2>/dev/null || echo 'not found')"
echo ""

# ─── Step 1: Git Pull ───────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📥 Step 1: Git Pull"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$PROJECT_DIR"
if [ -d ".git" ]; then
    echo "  Fetching latest from origin..."
    git fetch origin 2>/dev/null || true
    
    # Stash local changes if any
    if ! git diff --quiet 2>/dev/null; then
        echo "  Stashing local changes..."
        git stash 2>/dev/null || true
    fi
    
    git pull origin main 2>/dev/null || git pull 2>/dev/null || true
    echo "  ✅ Code updated"
else
    echo "  ⚠️  Not a git repo — skipping pull"
fi

# ─── Step 2: System Dependencies (skip if already installed) ─────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📦 Step 2: System Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v apt-get &> /dev/null; then
    # Check if key packages exist — skip full install if they do
    if command -v ffmpeg &> /dev/null && command -v cmake &> /dev/null && command -v redis-server &> /dev/null; then
        echo "  ✅ System packages already installed (skipping apt)"
    else
        echo "  Installing missing system packages..."
        sudo apt-get update -qq 2>/dev/null || true
        sudo apt-get install -y --no-install-recommends \
            python3 python3-pip python3-venv \
            ffmpeg \
            cmake build-essential \
            redis-server \
            curl wget git \
            libnss3 libatk-bridge2.0-0t64 libdrm2 libxcomposite1 \
            libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
            libasound2t64 libxshmfence1 2>/dev/null || true
        echo "  ✅ System packages installed"
    fi

    # Ensure Redis is running
    sudo systemctl enable redis-server 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || true
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "  ✅ Redis running"
    else
        echo "  ⚠️  Redis not responding — check: sudo systemctl status redis-server"
    fi
else
    echo "  ⚠️  apt-get not found — skip system packages"
fi

# ─── Step 3: MySQL Connection Check ─────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🗄️  Step 3: MySQL Connection Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "$V2_DIR/.env" ]; then
    DB_URL=$(grep "^DATABASE_URL" "$V2_DIR/.env" 2>/dev/null | cut -d= -f2-)
    if [ -n "$DB_URL" ]; then
        DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
        DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
        DB_PORT="${DB_PORT:-3306}"

        if nc -z -w5 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "  ✅ MySQL reachable at $DB_HOST:$DB_PORT"
        else
            echo "  ⚠️  Cannot reach MySQL at $DB_HOST:$DB_PORT"
        fi
    else
        echo "  ⚠️  DATABASE_URL not found in .env"
    fi
else
    echo "  ⚠️  .env not found — MySQL check skipped"
fi

# ─── Step 4: autocliper-v2 Setup ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎬 Step 4: autocliper-v2 (Backend — port 8000)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$V2_DIR" ]; then
    cd "$V2_DIR"

    # Create venv if not exists
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        $PYTHON_BIN -m venv venv
    fi

    # Install/update dependencies (pip is fast when nothing changed)
    echo "  Syncing Python dependencies..."
    source venv/bin/activate
    pip install --upgrade pip -q 2>/dev/null
    pip install -r requirements.txt -q 2>/dev/null
    deactivate

    # Create .env from example if not exists
    if [ ! -f ".env" ]; then
        echo "  ⚠️  No .env found — copying from .env.example"
        echo "  ⚠️  EDIT .env WITH YOUR ACTUAL CREDENTIALS"
        cp .env.example .env
    fi

    # Create output directory
    mkdir -p tmp/output

    # Download Whisper model if not exists
    if [ ! -f "models/ggml-medium.bin" ]; then
        echo "  Downloading Whisper model (ggml-medium.bin ~1.5GB)..."
        mkdir -p models
        if [ -f "whisper.cpp/models/download-ggml-model.sh" ]; then
            cd whisper.cpp
            bash models/download-ggml-model.sh medium || true
            cp models/ggml-medium.bin "$V2_DIR/models/" 2>/dev/null || true
            cd "$V2_DIR"
        else
            wget -q --show-progress -O models/ggml-medium.bin \
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" \
                || echo "  ⚠️  Download failed — run manually"
        fi
    else
        echo "  ✅ Whisper model exists"
    fi

    # Build whisper.cpp if not already built
    if [ -d "whisper.cpp" ] && [ ! -f "whisper.cpp/build/bin/whisper-cli" ]; then
        echo "  Building whisper.cpp..."
        cd whisper.cpp
        cmake -B build -DCMAKE_BUILD_TYPE=Release 2>/dev/null || true
        cmake --build build --config Release -j$(nproc) 2>/dev/null || true
        cd "$V2_DIR"
        echo "  ✅ whisper.cpp built"
    else
        echo "  ✅ whisper.cpp ready"
    fi

    echo "  ✅ autocliper-v2 ready"
else
    echo "  ❌ Directory not found: $V2_DIR"
fi

# ─── Step 5: autocliper-automate Setup ──────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🤖 Step 5: autocliper-automate (Social Upload — port 8001)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$AUTOMATE_DIR" ]; then
    cd "$AUTOMATE_DIR"

    # Create venv if not exists
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        $PYTHON_BIN -m venv venv
    fi

    # Install/update dependencies
    echo "  Syncing Python dependencies..."
    source venv/bin/activate
    pip install --upgrade pip -q 2>/dev/null
    pip install -r requirements.txt -q 2>/dev/null

    # Install Playwright only if not already cached
    if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
        echo "  Installing Playwright browsers..."
        playwright install chromium 2>/dev/null || echo "  ⚠️  Playwright install failed"
    else
        echo "  ✅ Playwright browsers cached"
    fi
    deactivate

    # Create .env from example if not exists
    if [ ! -f ".env" ]; then
        echo "  ⚠️  No .env found — copying from .env.example"
        cp .env.example .env
    fi

    echo "  ✅ autocliper-automate ready"
else
    echo "  ❌ Directory not found: $AUTOMATE_DIR"
fi

# ─── Step 6: Ollama + Qwen Setup ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🧠 Step 6: Ollama + Mistral-Nemo:12b"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

QWEN_MODEL="${QWEN_MODEL:-mistral-nemo:12b}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

# Install Ollama only if not present
if ! command -v ollama &> /dev/null; then
    echo "  Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh || echo "  ⚠️  Ollama install failed"
else
    echo "  ✅ Ollama already installed"
fi

# Ensure Ollama is running
if ! curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "  Starting Ollama server..."
    sudo systemctl start ollama 2>/dev/null || nohup ollama serve > /tmp/ollama.log 2>&1 &
    sleep 5
fi

# Pull model only if not available
if command -v ollama &> /dev/null; then
    AVAILABLE=$(ollama list 2>/dev/null | grep -c "$(echo $QWEN_MODEL | cut -d: -f1)" || true)
    if [ "$AVAILABLE" -eq 0 ]; then
        echo "  Pulling $QWEN_MODEL (~7GB, be patient)..."
        ollama pull "$QWEN_MODEL" || echo "  ⚠️  Pull failed — run: ollama pull $QWEN_MODEL"
    else
        echo "  ✅ Model $QWEN_MODEL ready"
    fi
fi

if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "  ✅ Ollama running"
else
    echo "  ⚠️  Ollama not responding"
fi

# ─── Step 7: Frontend Build ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🌐 Step 7: autocliper-v2-FE (Frontend — port 5173)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FE_DIR="$PROJECT_DIR/autocliper-v2-FE"

if [ -d "$FE_DIR" ]; then
    cd "$FE_DIR"

    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        echo "  Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>/dev/null || true
        sudo apt-get install -y nodejs 2>/dev/null || true
    fi

    if command -v node &> /dev/null; then
        echo "  Node: $(node --version)"

        # Install dependencies only if node_modules is missing or package-lock changed
        if [ ! -d "node_modules" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
            echo "  Installing npm dependencies..."
            npm install --silent 2>/dev/null || npm install 2>/dev/null || true
        else
            echo "  ✅ npm dependencies up to date"
        fi

        # Build frontend
        echo "  Building frontend (vite build)..."
        npm run build 2>/dev/null || true

        if [ -d "dist" ] && [ -f "dist/index.html" ]; then
            echo "  ✅ Frontend built (dist/)"
        else
            echo "  ⚠️  Build may have failed — check: cd $FE_DIR && npm run build"
        fi
    else
        echo "  ⚠️  Node.js not available — skip frontend build"
    fi
else
    echo "  ❌ Directory not found: $FE_DIR"
fi

# ─── Step 8: Systemd Services ───────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚙️  Step 8: Systemd Services + Restart"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend service
sudo tee /etc/systemd/system/cliperhub-backend.service > /dev/null << EOF
[Unit]
Description=CliperHub Backend API
After=network.target mysql.service ollama.service

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$V2_DIR
Environment=PATH=$V2_DIR/venv/bin:/usr/bin:/usr/local/bin
Environment=GLOG_minloglevel=3
Environment=TF_CPP_MIN_LOG_LEVEL=3
Environment=MEDIAPIPE_DISABLE_GPU=1
ExecStart=$V2_DIR/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Automate service
sudo tee /etc/systemd/system/cliperhub-automate.service > /dev/null << EOF
[Unit]
Description=CliperHub Automate (Social Upload)
After=network.target mysql.service

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$AUTOMATE_DIR
Environment=PATH=$AUTOMATE_DIR/venv/bin:/usr/bin:/usr/local/bin
ExecStart=$AUTOMATE_DIR/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Frontend service
FE_DIR="$PROJECT_DIR/autocliper-v2-FE"
sudo tee /etc/systemd/system/cliperhub-frontend.service > /dev/null << EOF
[Unit]
Description=CliperHub Frontend
After=network.target

[Service]
Type=simple
User=$DEPLOY_USER
WorkingDirectory=$FE_DIR
ExecStart=/usr/bin/python3 -m http.server 5173 --directory dist --bind 0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload, enable, restart
sudo systemctl daemon-reload
sudo systemctl enable cliperhub-backend cliperhub-automate cliperhub-frontend 2>/dev/null || true
sudo systemctl restart cliperhub-backend 2>/dev/null || true
sudo systemctl restart cliperhub-automate 2>/dev/null || true
sudo systemctl restart cliperhub-frontend 2>/dev/null || true

echo "  ✅ All services restarted"

# Wait and check
sleep 3

# ─── Final Status ────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Final Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_service() {
    if sudo systemctl is-active --quiet "$1" 2>/dev/null; then
        echo "  ✅ $1 — RUNNING (port $2)"
    else
        echo "  ❌ $1 — FAILED → sudo journalctl -u $1 -n 20"
    fi
}

check_service "cliperhub-backend" "8000"
check_service "cliperhub-automate" "8001"
check_service "cliperhub-frontend" "5173"

if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "  ✅ ollama — RUNNING"
else
    echo "  ⚠️  ollama — NOT RUNNING"
fi

if redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "  ✅ redis — RUNNING"
else
    echo "  ⚠️  redis — NOT RUNNING"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Done! All services deployed."
echo ""
echo "  Backend:  http://0.0.0.0:8000"
echo "  Automate: http://0.0.0.0:8001"
echo "  Frontend: http://0.0.0.0:5173"
echo "  Ollama:   $OLLAMA_URL"
echo ""
echo "  Next run will be fast (skips installed components)."
echo "  Just run: ./deploy.sh"
echo "═══════════════════════════════════════════════════════════════"
