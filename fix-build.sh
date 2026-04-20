#!/bin/bash
set -e

cd "$(dirname "$0")" || exit 1

echo "=== Step 1: Verify git status ==="
git status --short || true
echo ""

echo "=== Step 2: Stash local changes and restore source files ==="
git stash --include-untracked --message "auto-stash before fix-build" 2>/dev/null || true
git fetch origin

echo ""
echo "=== Step 3: Restore source files from HEAD (preserving config) ==="
git checkout HEAD -- src/ || true

echo ""
echo "=== Step 4: Verify critical files exist ==="
if [ ! -f "src/lib/utils.ts" ]; then
  echo "❌ ERROR: src/lib/utils.ts not found!"
  exit 1
fi
if [ ! -f "src/components/admin/MarkdownEditor.tsx" ]; then
  echo "❌ ERROR: src/components/admin/MarkdownEditor.tsx not found!"
  exit 1
fi
if [ ! -f "src/components/ui/IMEInput.tsx" ]; then
  echo "❌ ERROR: src/components/ui/IMEInput.tsx not found!"
  exit 1
fi
echo "✅ All critical files present"

echo ""
echo "=== Step 5: Deep clean - remove all caches and node_modules ==="
rm -rf .next
rm -rf node_modules/.cache
rm -rf node_modules
npm cache clean --force --verbose

echo ""
echo "=== Step 6: Reinstall dependencies with npm ci ==="
npm ci --preferred-offline --no-audit 2>&1 | tail -20

echo ""
echo "=== Step 7: Generate Prisma Client ==="
npx prisma generate

echo ""
echo "=== Step 8: Full rebuild with detailed output ==="
npm run build 2>&1 | tail -50

echo ""
echo "=== Step 9: Restart PM2 process ==="
pm2 restart x-blog || pm2 start npm --name x-blog -- start

echo ""
echo "✅ Build and restart completed successfully!"
echo "Check logs: pm2 logs x-blog"

echo ""
echo "=== Restoring stashed local changes ==="
git stash pop 2>/dev/null || true
