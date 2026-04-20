/**
 * 简单内存滑动窗口限流
 * 每 windowMs 内最多允许 max 次请求
 */
const hits = new Map<string, number[]>()
const MAX_KEYS = 10000

// 定期清理过期条目
setInterval(() => {
  const now = Date.now()
  hits.forEach((timestamps, key) => {
    const valid = timestamps.filter((t) => now - t < 120_000)
    if (valid.length === 0) hits.delete(key)
    else hits.set(key, valid)
  })
  if (hits.size > MAX_KEYS) {
    const entries = Array.from(hits.entries()).sort((a, b) => a[1][0] - b[1][0])
    const removeCount = hits.size - MAX_KEYS
    for (let i = 0; i < removeCount; i++) hits.delete(entries[i][0])
  }
}, 60_000)

export function rateLimit(key: string, { max, windowMs }: { max: number; windowMs: number }): boolean {
  const now = Date.now()
  const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs)
  if (timestamps.length >= max) return false
  timestamps.push(now)
  hits.set(key, timestamps)
  return true
}
