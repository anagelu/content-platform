#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/pattern-foundry/current}"
PM2_APP_NAME="${PM2_APP_NAME:-pattern-foundry}"

cd "$APP_DIR"

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npm run db:generate

echo "Applying production migrations..."
npm run db:migrate:deploy

echo "Building app..."
npm run build

if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  echo "Reloading PM2 app..."
  pm2 reload "$PM2_APP_NAME" --update-env
else
  echo "Starting PM2 app..."
  pm2 start ecosystem.config.cjs --only "$PM2_APP_NAME"
fi

echo "Deployment complete."
