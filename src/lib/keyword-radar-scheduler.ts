import { runKeywordRadar, getKeywordRadarConfig } from '@/lib/keyword-radar'
import { pruneKeywordRadarLogs } from '@/lib/keyword-radar-log'

declare global {
  var __keywordRadarSchedulerStarted: boolean | undefined
  var __keywordRadarSchedulerTimer: NodeJS.Timeout | undefined
}

const MIN_TICK_MS = 30_000
const PRUNE_INTERVAL_MS = 6 * 3600 * 1000

export function ensureKeywordRadarScheduler() {
  if (globalThis.__keywordRadarSchedulerStarted) return
  globalThis.__keywordRadarSchedulerStarted = true

  let lastPrune = 0

  const tick = async () => {
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

  const scheduleNext = () => {
    getKeywordRadarConfig()
      .then((cfg) => {
        const ms = Math.max(MIN_TICK_MS, cfg.scheduleMinutes * 60 * 1000 * 0.95)
        if (globalThis.__keywordRadarSchedulerTimer) clearTimeout(globalThis.__keywordRadarSchedulerTimer)
        globalThis.__keywordRadarSchedulerTimer = setTimeout(tick, ms)
        globalThis.__keywordRadarSchedulerTimer.unref?.()
      })
      .catch(() => {
        globalThis.__keywordRadarSchedulerTimer = setTimeout(tick, 60_000)
        globalThis.__keywordRadarSchedulerTimer.unref?.()
      })
  }

  setTimeout(tick, 5000)
}
