#!/bin/bash
# Start cron daemon in background + Flask trigger server in foreground

echo "Starting cron daemon..."
cron

echo "Starting trigger server on port 5000..."
exec python3 /app/scraper/trigger_server.py
