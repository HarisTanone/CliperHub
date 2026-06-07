#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# AutoCliper — Full Server Deployment Script
#
# Handles:
#   1. System dependencies (ffmpeg, python3, etc.)
#   2. autocliper-v2 (backend, port 8000)
#   3. autocliper-automate (social upload, port 8001)
#   4. Ollama + Qwen2.5:14b setup
#   5. Systemd services (auto-restart)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# Run on: Ubuntu/Debian server
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
V2_DIR="$PROJECT_DIR/autocliper-v2"
AUTOMATE_DIR="$PROJECT_DIR/autocliper-automate"
USER=$(whoami)
PYTHON_BIN="python3"

echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 AutoCliper — Server Deployment"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Project: $PROJECT_DIR"
echo "  User:    $USER"
echo "  Python:  $($PYTHON_BIN --version 2>/dev/null || echo 'not found')"
echo ""

# ─── Step 1: System Dependencies ────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📦 Step 1: System Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v apt-get &> /dev/null; then
    echo "  Installing system packages..."
    sudo apt-get update -qq
    sudo apt-get install -y -qq \
        python3 python3-pip python3-venv \
        ffmpeg \
        cmake build-essential \
        redis-server \
        curl wget git \
        libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
        libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
        libasound2 libxshmfence1 2>/dev/null
    echo "  ✅ System packages installed"
    
    # Start and enable Redis
    echo "  Starting Redis..."
    sudo systemctl enable redis-server 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || true
    if redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo "  ✅ Redis running (PONG)"
    else
        echo "  ⚠️  Redis installed but not responding — check manually"
    fi
else
    echo "  ⚠️  apt-get not found — skip system packages (manual install needed)"
fi

# ─── Step 2: autocliper-v2 Setup ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🗄️  Step 1b: MySQL Connection Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Read DB config from .env if available
if [ -f "$V2_DIR/.env" ]; then
    DB_URL=$(grep "^DATABASE_URL" "$V2_DIR/.env" 2>/dev/null | cut -d= -f2-)
    if [ -n "$DB_URL" ]; then
        # Extract host from DATABASE_URL
        DB_HOST=$(echo "$DB_URL" | sed -E 's|.*@([^:/]+).*|\1|')
        DB_PORT=$(echo "$DB_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
        DB_PORT="${DB_PORT:-3306}"
        
        echo "  Checking MySQL at $DB_HOST:$DB_PORT..."
        if command -v mysqladmin &> /dev/null; then
            if mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" --connect-timeout=5 2>/dev/null | grep -q "alive"; then
                echo "  ✅ MySQL reachable at $DB_HOST:$DB_PORT"
            else
                echo "  ⚠️  MySQL not responding at $DB_HOST:$DB_PORT"
            fi
        elif nc -z -w5 "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "  ✅ MySQL port open at $DB_HOST:$DB_PORT"
        else
            echo "  ⚠️  Cannot reach MySQL at $DB_HOST:$DB_PORT — check connection"
        fi
    else
        echo "  ⚠️  DATABASE_URL not found in .env"
    fi
else
    echo "  ⚠️  .env not found yet — MySQL check skipped (will check after .env created)"
fi

# ─── Step 2: autocliper-v2 Setup ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎬 Step 2: autocliper-v2 (Backend — port 8000)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$V2_DIR" ]; then
    cd "$V2_DIR"
    
    # Create venv if not exists
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        $PYTHON_BIN -m venv venv
    fi
    
    # Install dependencies
    echo "  Installing Python dependencies..."
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    deactivate
    
    # Create .env from example if not exists
    if [ ! -f ".env" ]; then
        echo "  ⚠️  No .env found — copying from .env.example"
        echo "  ⚠️  EDIT .env WITH YOUR ACTUAL CREDENTIALS BEFORE STARTING"
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
            bash models/download-ggml-model.sh medium
            cp models/ggml-medium.bin "$V2_DIR/models/" 2>/dev/null || true
            cd "$V2_DIR"
        else
            wget -q --show-progress -O models/ggml-medium.bin \
                "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin" \
                || echo "  ⚠️  Whisper model download failed — download manually"
        fi
        
        if [ -f "models/ggml-medium.bin" ]; then
            echo "  ✅ Whisper model downloaded"
        fi
    else
        echo "  ✅ Whisper model already exists"
    fi
    
    # Build whisper.cpp if not already built
    if [ -d "whisper.cpp" ] && [ ! -f "whisper.cpp/build/bin/whisper-cli" ]; then
        echo "  Building whisper.cpp..."
        cd whisper.cpp
        cmake -B build -DCMAKE_BUILD_TYPE=Release 2>/dev/null
        cmake --build build --config Release -j$(nproc) 2>/dev/null
        cd "$V2_DIR"
        echo "  ✅ whisper.cpp built"
    fi
    
    echo "  ✅ autocliper-v2 ready"
else
    echo "  ❌ Directory not found: $V2_DIR"
fi

# ─── Step 3: autocliper-automate Setup ──────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🤖 Step 3: autocliper-automate (Social Upload — port 8001)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "$AUTOMATE_DIR" ]; then
    cd "$AUTOMATE_DIR"
    
    # Create venv if not exists
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        $PYTHON_BIN -m venv venv
    fi
    
    # Install dependencies
    echo "  Installing Python dependencies..."
    source venv/bin/activate
    pip install --upgrade pip -q
    pip install -r requirements.txt -q
    
    # Install Playwright browsers
    echo "  Installing Playwright browsers..."
    playwright install chromium 2>/dev/null || echo "  ⚠️  Playwright install skipped (run manually if needed)"
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

# ─── Step 4: Ollama + Qwen Setup ────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🧠 Step 4: Ollama + Qwen2.5:14b"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

QWEN_MODEL="${QWEN_MODEL:-qwen2.5:14b}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

# Install Ollama if needed
if ! command -v ollama &> /dev/null; then
    echo "  Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# Start Ollama if not running
if ! curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "  Starting Ollama server..."
    if systemctl start ollama 2>/dev/null; then
        sleep 3
    else
        nohup ollama serve > /tmp/ollama.log 2>&1 &
        sleep 5
    fi
fi

# Pull model if not available
AVAILABLE=$(ollama list 2>/dev/null | grep -c "$(echo $QWEN_MODEL | cut -d: -f1)" || true)
if [ "$AVAILABLE" -eq 0 ]; then
    echo "  Pulling $QWEN_MODEL (this takes a while for 14B)..."
    ollama pull "$QWEN_MODEL"
fi

echo "  ✅ Ollama + $QWEN_MODEL ready"

# ─── Step 5: Systemd Services ───────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚙️  Step 5: Systemd Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backend service
sudo tee /etc/systemd/system/cliperhub-backend.service > /dev/null << EOF
[Unit]
Description=CliperHub Backend API
After=network.target mysql.service ollama.service

[Service]
Type=simple
User=$USER
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
echo "  ✅ cliperhub-backend.service created"

# Automate service
sudo tee /etc/systemd/system/cliperhub-automate.service > /dev/null << EOF
[Unit]
Description=CliperHub Automate (Social Upload)
After=network.target mysql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$AUTOMATE_DIR
Environment=PATH=$AUTOMATE_DIR/venv/bin:/usr/bin:/usr/local/bin
ExecStart=$AUTOMATE_DIR/venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
echo "  ✅ cliperhub-automate.service created"

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable cliperhub-backend cliperhub-automate 2>/dev/null
echo "  ✅ Services enabled (auto-start on boot)"

# ─── Step 6: Start Services ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 Step 6: Starting Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sudo systemctl restart cliperhub-backend
echo "  ✅ cliperhub-backend started (port 8000)"

sudo systemctl restart cliperhub-automate
echo "  ✅ cliperhub-automate started (port 8001)"

# Wait and check
sleep 3

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📊 Service Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_service() {
    local name=$1
    local port=$2
    if sudo systemctl is-active --quiet "$name"; then
        echo "  ✅ $name — RUNNING (port $port)"
    else
        echo "  ❌ $name — FAILED"
        echo "     Check logs: sudo journalctl -u $name -n 20 --no-pager"
    fi
}

check_service "cliperhub-backend" "8000"
check_service "cliperhub-automate" "8001"

# Check Ollama
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "  ✅ ollama — RUNNING ($OLLAMA_URL)"
else
    echo "  ⚠️  ollama — NOT RUNNING"
fi

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Deployment Complete!"
echo ""
echo "  Backend:  http://0.0.0.0:8000"
echo "  Automate: http://0.0.0.0:8001"
echo "  Ollama:   $OLLAMA_URL"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status cliperhub-backend"
echo "    sudo systemctl status cliperhub-automate"
echo "    sudo journalctl -u cliperhub-backend -f"
echo "    sudo journalctl -u cliperhub-automate -f"
echo "    sudo systemctl restart cliperhub-backend"
echo "    sudo systemctl restart cliperhub-automate"
echo "═══════════════════════════════════════════════════════════════"
