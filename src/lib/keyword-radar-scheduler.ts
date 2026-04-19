import { runKeywordRadar, getKeywordRadarConfig } from '@/lib/keyword-radar'
import { pruneKeywordRadarLogs } from '@/lib/keyword-radar-log'

declare global {
  var __keywordRadarSchedulerStarted: boolean | undefined
  var __keywordRadarSchedulerTimer: NodeJS.Timeout | undefined
  var __keywordRadarSchedulerStartedAt: number | undefined
}

const MIN_TICK_MS = 5_000
const DISABLED_RECHECK_MS = 5 * 60 * 1000
const PRUNE_INTERVAL_MS = 6 * 3600 * 1000

export function ensureKeywordRadarScheduler() {
  const now = Date.now()
  if (globalThis.__keywordRadarSchedulerStarted && globalThis.__keywordRadarSchedulerTimer) {
    const startedAt = globalThis.__keywordRadarSchedulerStartedAt || 0
    const maxDelay = Math.max(DISABLED_RECHECK_MS, 24 * 60 * 60 * 1000)
    if (now - startedAt < maxDelay) {
      return
    }
  }
  globalThis.__keywordRadarSchedulerStarted = true
  globalThis.__keywordRadarSchedulerStartedAt = now

  let lastPrune = 0

  const scheduleNext = () => {
    getKeywordRadarConfig()
      .then((cfg) => {
        let delayMs = DISABLED_RECHECK_MS
        if (cfg.enabled) {
          const intervalMs = cfg.scheduleMinutes * 60 * 1000
          if (cfg.lastRunAt) {
            const elapsedMs = Date.now() - new Date(cfg.lastRunAt).getTime()
            const remainingMs = intervalMs - elapsedMs
            delayMs = remainingMs > 0 ? Math.max(MIN_TICK_MS, remainingMs) : MIN_TICK_MS
          } else {
            delayMs = MIN_TICK_MS
          }
        }
        if (globalThis.__keywordRadarSchedulerTimer) clearTimeout(globalThis.__keywordRadarSchedulerTimer)
        globalThis.__keywordRadarSchedulerStartedAt = Date.now()
        globalThis.__keywordRadarSchedulerTimer = setTimeout(tick, delayMs)
        globalThis.__keywordRadarSchedulerTimer.unref?.()
      })
      .catch(() => {
        if (globalThis.__keywordRadarSchedulerTimer) clearTimeout(globalThis.__keywordRadarSchedulerTimer)
        globalThis.__keywordRadarSchedulerStartedAt = Date.now()
        globalThis.__keywordRadarSchedulerTimer = setTimeout(tick, DISABLED_RECHECK_MS)
        globalThis.__keywordRadarSchedulerTimer.unref?.()
      })
  }

  const tick = async () => {
    globalThis.__keywordRadarSchedulerTimer = undefined
    try {
      await runKeywordRadar({ reason: 'scheduler' })
    } catch {}
    if (Date.now() - lastPrune > PRUNE_INTERVAL_MS) {
      lastPrune = Date.now()
      try {
        await pruneKeywordRadarLogs()
      } catch {}
    }
    scheduleNext()
  }

  scheduleNext()
}
