#!/bin/bash
set -e

echo "=== Step 1: Force checkout missing files ==="
git checkout HEAD -- src/lib/utils.ts src/components/admin/MarkdownEditor.tsx src/components/ui/IMEInput.tsx src/hooks/useIMEInput.ts src/hooks/useTheme.ts

echo "=== Step 2: Clear all caches ==="
rm -rf node_modules/.cache
rm -rf .next
npm cache clean --force

echo "=== Step 3: Reinstall dependencies ==="
npm ci

echo "=== Step 4: Rebuild ==="
npm run build

echo "=== Step 5: Restart PM2 ==="
pm2 restart x-blog

echo "✅ Build and restart completed successfully!"
