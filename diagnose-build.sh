#!/bin/bash
# 诊断脚本 - 用于排查构建问题根源

set -e

echo "====== x-blog BUILD TROUBLESHOOTING ======"
echo ""

echo "=== 1. Git Status ==="
git status --short || true
echo ""

echo "=== 2. Check critical files exist ==="
for file in src/lib/utils.ts src/components/admin/MarkdownEditor.tsx src/components/ui/IMEInput.tsx; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ MISSING: $file"
  fi
done
echo ""

echo "=== 3. Verify git tree contains files ==="
for file in src/lib/utils.ts src/components/admin/MarkdownEditor.tsx src/components/ui/IMEInput.tsx; do
  if git show HEAD:"$file" > /dev/null 2>&1; then
    echo "✅ $file in git tree"
  else
    echo "❌ $file NOT in git tree"
  fi
done
echo ""

echo "=== 4. Check tsconfig.json paths ==="
grep -A1 '"paths"' tsconfig.json || echo "WARNING: paths not found in tsconfig.json"
echo ""

echo "=== 5. Check next.config.js transpilePackages ==="
grep -i 'transpile' next.config.js | head -3 || echo "WARNING: transpilePackages not found"
echo ""

echo "=== 6. Verify import statements in problematic files ==="
echo "--- search/page.tsx imports ---"
grep "^import.*from.*@/" src/app/*/search/page.tsx 2>/dev/null | head -5 || echo "File not found"
echo ""
echo "--- admin/posts/[id]/page.tsx imports ---"
grep "^import.*from.*@/" src/app/admin/posts/*/page.tsx 2>/dev/null | head -5 || echo "File not found"
echo ""

echo "=== 7. Check Node modules for missing deps ==="
echo "Checking: clsx date-fns @uiw/react-md-editor"
npm list clsx date-fns @uiw/react-md-editor 2>&1 | grep -E '@|clsx|date-fns|@uiw' | head -10 || echo "Some deps may be missing"
echo ""

echo "=== 8. Check .env configuration ==="
if [ -f ".env" ]; then
  echo "✅ .env exists"
  grep "DATABASE_URL\|JWT_SECRET\|NEXT_PUBLIC" .env | head -3 || echo "WARNING: Key env vars not set"
else
  echo "❌ .env not found"
fi
echo ""

echo "=== 9. Disk space ==="
df -h . | tail -1
echo ""

echo "=== 10. Current HEAD ==="
git log -1 --oneline
echo ""

echo "====== END DIAGNOSTICS ======"
echo ""
echo "If files are missing:"
echo "  1. Run: git checkout HEAD -- src/"
echo "  2. Then: ./fix-build.sh"
echo ""
echo "If dependencies are missing:"
echo "  1. Delete: rm -rf node_modules"
echo "  2. Run: npm ci"
echo "  3. Then: npm run build"
