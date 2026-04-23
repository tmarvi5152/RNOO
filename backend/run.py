#!/usr/bin/env python
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from uvicorn import run

# Ensure backend directory in path and as working directory
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))
os.chdir(BASE_DIR)

# Load environment variables from .env if present
load_dotenv(BASE_DIR / ".env")

from server import app  # Import after path/env setup

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8765"))
    log_level = os.environ.get("LOG_LEVEL", "info")
    reload = os.environ.get("RELOAD", "false").lower() in ("1", "true", "yes")
    print(f"Starting RNOO backend on {host}:{port} (reload={reload})")
    run(app, host=host, port=port, log_level=log_level, reload=reload)
