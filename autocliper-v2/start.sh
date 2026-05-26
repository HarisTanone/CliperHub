#!/bin/bash

# AutoCliper v2 - Quick Start Script
# Checks cookies and starts server

cd "$(dirname "$0")"

echo "🚀 AutoCliper v2 - Starting..."
echo ""

# Check if cookies are available
echo "🍪 Checking YouTube cookies..."

# Check Chrome
if [ -d "$HOME/Library/Application Support/Google/Chrome/Default" ]; then
    echo "  ✅ Chrome cookies found"
    CHROME_OK=1
else
    echo "  ⚠️  Chrome not found or not logged in"
    CHROME_OK=0
fi

# Check Safari
if [ -f "$HOME/Library/Cookies/Cookies.binarycookies" ]; then
    echo "  ✅ Safari cookies found"
    SAFARI_OK=1
else
    echo "  ⚠️  Safari cookies not found"
    SAFARI_OK=0
fi

# Check manual cookies.txt
if [ -f "cookies.txt" ]; then
    echo "  ✅ Manual cookies.txt found"
    MANUAL_OK=1
else
    echo "  ℹ️  No manual cookies.txt (optional)"
    MANUAL_OK=0
fi

echo ""

# Warning if no cookies
if [ $CHROME_OK -eq 0 ] && [ $SAFARI_OK -eq 0 ] && [ $MANUAL_OK -eq 0 ]; then
    echo "⚠️  WARNING: No YouTube cookies found!"
    echo ""
    echo "📋 SOLUSI:"
    echo "1. Login ke YouTube di Chrome atau Safari"
    echo "2. Tonton video yang ingin didownload"
    echo "3. Restart script ini"
    echo ""
    echo "Atau baca: YOUTUBE_COOKIES_FIX.md"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Activate venv
if [ -d "venv311" ]; then
    echo "🐍 Activating venv311..."
    source venv311/bin/activate
elif [ -d "venv" ]; then
    echo "🐍 Activating venv..."
    source venv/bin/activate
else
    echo "❌ Virtual environment not found!"
    echo "Run: python3 -m venv venv311 && source venv311/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check if port 8000 is in use
if lsof -ti:8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is already in use"
    read -p "Kill existing process? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:8000 | xargs kill -9
        echo "✅ Killed existing process"
        sleep 1
    else
        exit 1
    fi
fi

# Start server
echo ""
echo "🎬 Starting AutoCliper v2 server..."
echo "📡 Server: http://0.0.0.0:8000"
echo "📊 Health: http://0.0.0.0:8000/health"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python3 main.py
