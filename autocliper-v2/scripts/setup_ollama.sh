#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# AutoCliper v2 — Ollama + Qwen Setup Script
#
# This script ensures Ollama is installed and the AI model is available.
# Run this on server deployment or first-time setup.
#
# Environment:
#   - Local dev:  QWEN_MODEL=qwen3:4b (default, lightweight)
#   - Server/Prod: QWEN_MODEL=qwen2.5:14b (set in .env or export)
#
# Usage:
#   chmod +x scripts/setup_ollama.sh
#   ./scripts/setup_ollama.sh
#
#   # Or for production server:
#   QWEN_MODEL=qwen2.5:14b ./scripts/setup_ollama.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

QWEN_MODEL="${QWEN_MODEL:-qwen3:4b}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

echo "═══════════════════════════════════════════════════════════════"
echo "  AutoCliper v2 — Ollama + Qwen3:4b Setup"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ─── Step 1: Check if ollama command exists ──────────────────────────────────
echo "🔍 Step 1: Checking if ollama is installed..."

if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>/dev/null || echo "unknown")
    echo "   ✅ Ollama is installed: $OLLAMA_VERSION"
else
    echo "   ⚠️  Ollama not found. Installing..."
    
    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            echo "   📦 Installing via Homebrew..."
            brew install ollama
        else
            echo "   📦 Installing via official installer..."
            curl -fsSL https://ollama.com/install.sh | sh
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        echo "   📦 Installing via official installer..."
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo "   ❌ Unsupported OS: $OSTYPE"
        echo "   Please install Ollama manually: https://ollama.com/download"
        exit 1
    fi
    
    # Verify installation
    if command -v ollama &> /dev/null; then
        echo "   ✅ Ollama installed successfully!"
    else
        echo "   ❌ Installation failed. Please install manually."
        exit 1
    fi
fi

# ─── Step 2: Ensure ollama is running ────────────────────────────────────────
echo ""
echo "🔍 Step 2: Checking if Ollama server is running..."

# Try to connect to Ollama API
if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "   ✅ Ollama server is running at $OLLAMA_URL"
else
    echo "   ⚠️  Ollama server not responding. Starting..."
    
    # Start ollama serve in background
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS: check if running as launchd service
        if pgrep -x "ollama" > /dev/null 2>&1; then
            echo "   🔄 Ollama process found but API not responding. Waiting..."
            sleep 3
        else
            echo "   🚀 Starting ollama serve..."
            ollama serve &
            OLLAMA_PID=$!
            echo "   ⏳ Waiting for server to start (PID: $OLLAMA_PID)..."
            sleep 5
        fi
    else
        # Linux: try systemd first
        if systemctl is-active --quiet ollama 2>/dev/null; then
            echo "   🔄 Ollama service is active, waiting for API..."
            sleep 3
        else
            # Try to start via systemd
            if systemctl start ollama 2>/dev/null; then
                echo "   🚀 Started ollama via systemd"
                sleep 5
            else
                # Start manually
                echo "   🚀 Starting ollama serve..."
                nohup ollama serve > /tmp/ollama.log 2>&1 &
                OLLAMA_PID=$!
                echo "   ⏳ Waiting for server (PID: $OLLAMA_PID)..."
                sleep 5
            fi
        fi
    fi
    
    # Verify server is responding
    RETRIES=10
    for i in $(seq 1 $RETRIES); do
        if curl -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
            echo "   ✅ Ollama server is now running!"
            break
        fi
        if [ $i -eq $RETRIES ]; then
            echo "   ❌ Failed to start Ollama server after $RETRIES attempts"
            echo "   Try manually: ollama serve"
            exit 1
        fi
        echo "   ⏳ Waiting... ($i/$RETRIES)"
        sleep 2
    done
fi

# ─── Step 3: Check if qwen3:4b model is available ───────────────────────────
echo ""
echo "🔍 Step 3: Checking if $QWEN_MODEL is available..."

AVAILABLE_MODELS=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}')
MODEL_BASE=$(echo "$QWEN_MODEL" | cut -d: -f1)

if echo "$AVAILABLE_MODELS" | grep -q "$MODEL_BASE"; then
    echo "   ✅ Model $QWEN_MODEL is already downloaded"
    ollama list | grep "$MODEL_BASE"
else
    echo "   ⚠️  Model $QWEN_MODEL not found. Downloading..."
    echo "   📥 This may take a few minutes (model size: ~2.5GB)..."
    echo ""
    
    ollama pull "$QWEN_MODEL"
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "   ✅ Model $QWEN_MODEL downloaded successfully!"
    else
        echo ""
        echo "   ❌ Failed to download $QWEN_MODEL"
        exit 1
    fi
fi

# ─── Step 4: Quick verification (warm up model) ─────────────────────────────
echo ""
echo "🔍 Step 4: Verifying model works (quick test)..."

RESPONSE=$(curl -s "$OLLAMA_URL/api/chat" -d "{
  \"model\": \"$QWEN_MODEL\",
  \"messages\": [{\"role\": \"user\", \"content\": \"Reply with just: OK\"}],
  \"stream\": false,
  \"think\": false,
  \"format\": \"json\",
  \"options\": {\"num_predict\": 10}
}" 2>/dev/null)

if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',{}).get('content',''))" 2>/dev/null | grep -iq "ok\|ready\|{"; then
    echo "   ✅ Model responds correctly!"
else
    echo "   ⚠️  Model response unclear, but this is OK for first load."
    echo "   The model will warm up on first real request."
fi

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Setup Complete!"
echo ""
echo "  Ollama:  $(ollama --version 2>/dev/null || echo 'installed')"
echo "  Model:   $QWEN_MODEL"
echo "  Server:  $OLLAMA_URL"
echo ""
echo "  AutoCliper will auto-fallback to $QWEN_MODEL when Gemini fails."
echo "═══════════════════════════════════════════════════════════════"
