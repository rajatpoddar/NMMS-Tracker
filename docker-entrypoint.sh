#!/bin/sh
set -e

echo "=== NMMS Tracker Starting ==="
echo "Time (IST): $(date)"

echo ""
echo "Running Prisma migrations..."
# prisma binary is at node_modules/prisma/build/index.js in the runner stage
node node_modules/prisma/build/index.js migrate deploy

echo ""
echo "Migrations done. Starting Next.js..."
exec node server.js
