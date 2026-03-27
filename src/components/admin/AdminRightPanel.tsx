'use client'
import { useEffect, useState } from 'react'

type SysInfo = {
  nodeVersion: string
  platform: string
  arch: string
  hostname: string
  cpus: number
  cpuModel: string
  totalMemMB: number
  freeMemMB: number
  usedMemMB: number
  memPercent: number
  heapUsedMB: number
  heapTotalMB: number
  rssMB: number
  uptimeStr: string
  osUptime: string
  loadAvg: string[]
}

function InfoRow({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs font-mono font-medium" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

function MemBar({ percent }: { percent: number }) {
  const color = percent > 85 ? '#F4212E' : percent > 65 ? '#F59E0B' : '#22C55E'
  return (
    <div className="w-full rounded-full h-1.5 mt-1" style={{ background: 'var(--border)' }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${percent}%`, background: color }} />
    </div>
  )
}

export function AdminRightPanel() {
  const [info, setInfo] = useState<SysInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchInfo = async () => {
    try {
      const res = await fetch('/api/admin/sysinfo')
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setInfo(data)
      setLastRefresh(new Date())
    } catch {
      setInfo(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInfo()
    const timer = setInterval(fetchInfo, 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <aside className="flex flex-col gap-4">
      {/* 系统信息 */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>🖥 系统信息</h3>
          <button
            onClick={fetchInfo}
            title="刷新"
            className="w-7 h-7 flex items-center justify-center rounded-full text-base transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >↺</button>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />)}
          </div>
        ) : info ? (
          <div>
            <InfoRow label="Node.js" value={info.nodeVersion} accent />
            <InfoRow label="平台" value={`${info.platform} / ${info.arch}`} />
            <InfoRow label="主机名" value={info.hostname} />
            <InfoRow label="CPU" value={`${info.cpus} 核`} />
            <InfoRow label="型号" value={info.cpuModel} />
            <InfoRow label="进程运行" value={info.uptimeStr} accent />
            <InfoRow label="系统运行" value={info.osUptime} />
          </div>
        ) : (
          <p className="text-xs py-2" style={{ color: 'var(--text-secondary)' }}>无法获取系统信息</p>
        )}
      </div>

      {/* 内存使用 */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)' }}>
        <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>💾 内存使用</h3>
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1,2].map(i => <div key={i} className="h-8 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />)}
          </div>
        ) : info ? (
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>系统内存</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
                  {info.usedMemMB} / {info.totalMemMB} MB
                  <span className="ml-1" style={{ color: info.memPercent > 85 ? '#F4212E' : info.memPercent > 65 ? '#F59E0B' : '#22C55E' }}>
                    {info.memPercent}%
                  </span>
                </span>
              </div>
              <MemBar percent={info.memPercent} />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Node 堆内存</span>
                <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{info.heapUsedMB} / {info.heapTotalMB} MB</span>
              </div>
              <MemBar percent={Math.round((info.heapUsedMB / info.heapTotalMB) * 100)} />
            </div>
            <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>RSS 占用</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{info.rssMB} MB</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* 系统负载（非 Windows 才有意义） */}
      {!loading && info && info.loadAvg[0] !== '0.00' && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-secondary)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>📊 系统负载</h3>
          <div className="grid grid-cols-3 gap-2">
            {['1分钟', '5分钟', '15分钟'].map((label, i) => (
              <div key={i} className="flex flex-col items-center gap-1 py-2 rounded-xl" style={{ background: 'var(--bg-hover)' }}>
                <span className="text-base font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{info.loadAvg[i]}</span>
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastRefresh && (
        <p className="text-center text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {lastRefresh.toLocaleTimeString('zh-CN')} 更新 · 每30秒自动刷新
        </p>
      )}
    </aside>
  )
}
