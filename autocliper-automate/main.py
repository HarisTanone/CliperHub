#!/usr/bin/env python3
"""
AutoCliper Automate - TikTok Auto Upload Server
Main entry point
"""
import uvicorn
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

if __name__ == "__main__":
    uvicorn.run(
        "src.presentation.api:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
