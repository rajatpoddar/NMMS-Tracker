#!/usr/bin/env python3
"""
Lightweight HTTP trigger server for the NMMS scraper.
Listens on port 5000 — called by the Next.js webapp for manual scrape triggers.

Endpoints:
  POST /trigger?date=YYYY-MM-DD   — run scraper for given date (default: today)
  GET  /health                    — health check
"""

import logging
import os
import subprocess
import sys
from datetime import datetime
from flask import Flask, jsonify, request

app = Flask(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

SCRAPER_PATH = os.path.join(os.path.dirname(__file__), "scraper.py")
API_URL = os.environ.get("API_URL", "http://webapp:3000")
PHOTOS_DIR = os.environ.get("PHOTOS_DIR", "/app/data/photos")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200


@app.route("/trigger", methods=["POST"])
def trigger():
    date = request.args.get("date") or datetime.today().strftime("%Y-%m-%d")
    scrape_log_id = request.args.get("scrapeLogId", "0")

    # Basic date format validation
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"success": False, "error": f"Invalid date format: {date}"}), 400

    log.info(f"Manual trigger received for date: {date}, scrapeLogId: {scrape_log_id}")

    cmd = [
        "python3", SCRAPER_PATH,
        "--date", date,
        "--api-url", API_URL,
        "--scrape-log-id", scrape_log_id,
    ]

    env = os.environ.copy()
    env["PHOTOS_DIR"] = PHOTOS_DIR

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 min max
            env=env,
        )

        success = result.returncode == 0
        log.info(f"Scraper finished with returncode={result.returncode}")

        return jsonify({
            "success": success,
            "date": date,
            "output": result.stdout[-5000:] if result.stdout else "",   # last 5k chars
            "errors": result.stderr[-2000:] if result.stderr else None,
        }), 200 if success else 500

    except subprocess.TimeoutExpired:
        log.error("Scraper timed out after 10 minutes")
        return jsonify({"success": False, "error": "Scraper timed out"}), 504
    except Exception as e:
        log.error(f"Failed to run scraper: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    log.info(f"Trigger server starting on port 5000 | API_URL={API_URL}")
    app.run(host="0.0.0.0", port=5000, debug=False)
