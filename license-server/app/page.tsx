'use client'
import { useEffect, useState } from 'react'

type DomainEntry = {
  domain: string
  addedAt: string
  note?: string
}

type LogEntry = {
  domain: string
  time: string
  authorized: boolean
}

export default function LicenseDashboard() {
  const [domains, setDomains] = useState<DomainEntry[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [newDomain, setNewDomain] = useState('')
  const [newNote, setNewNote] = useState('')
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testDomain, setTestDomain] = useState('')
  const [testResult, setTestResult] = useState<null | { valid: boolean; msg: string }>(null)
  const [serverInfo, setServerInfo] = useState<{ domains: number; time: string } | null>(null)

  const headers = { 'Content-Type': 'application/json', 'x-admin-key': adminKey }

  const load = async () => {
    setLoading(true)
    try {
      const [dRes, lRes, iRes] = await Promise.all([
        fetch('/api/domains', { headers }),
        fetch('/api/logs', { headers }),
        fetch('/api/verify'),
      ])
      if (dRes.status === 401) { setAuthed(false); setLoading(false); return }
      setDomains(await dRes.json())
      setLogs(await lRes.json())
      setServerInfo(await iRes.json())
      setAuthed(true)
    } catch { }
    setLoading(false)
  }

  const login = async () => { await load() }

  const addDomain = async () => {
    if (!newDomain.trim()) return
    await fetch('/api/domains', { method: 'POST', headers, body: JSON.stringify({ domain: newDomain.trim(), note: newNote.trim() }) })
    setNewDomain(''); setNewNote('')
    await load()
  }

  const removeDomain = async (domain: string) => {
    if (!confirm(`确认撤销 ${domain} 的授权？`)) return
    await fetch('/api/domains', { method: 'DELETE', headers, body: JSON.stringify({ domain }) })
    await load()
  }

  const doTest = async () => {
    if (!testDomain.trim()) return
    const ts = Date.now().toString()
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: testDomain.trim(), timestamp: ts, sig: 'test-bypass', _adminKey: adminKey }),
    })
    const d = await res.json()
    setTestResult({ valid: d.valid, msg: d.valid ? '✅ 已授权' : '❌ 未授权：' + (d.error || '') })
  }

  useEffect(() => { }, [])

  const card = { background: '#16181c', border: '1px solid #2f3336', borderRadius: 16, padding: 24 }
  const input = { background: '#1c1f23', border: '1px solid #2f3336', borderRadius: 8, padding: '8px 12px', color: '#e7e9ea', outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontSize: 14 }
  const btn = (color = '#1d9bf0') => ({ background: color, color: '#fff', border: 'none', borderRadius: 20, padding: '8px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 })

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...card, width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>🔑 License Manager</h1>
        <p style={{ margin: 0, color: '#8899a6', fontSize: 14 }}>输入管理密钥登录</p>
        <input style={input} type="password" placeholder="Admin Key" value={adminKey} onChange={e => setAdminKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} />
        <button style={btn()} onClick={login}>登录</button>
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 顶部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>🔑 License Manager</h1>
          <p style={{ margin: '4px 0 0', color: '#8899a6', fontSize: 13 }}>project-x 授权域名管理</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {serverInfo && <span style={{ fontSize: 12, color: '#8899a6' }}>共 {serverInfo.domains} 个授权域名</span>}
          <button style={btn('#1c1f23')} onClick={load}>🔄 刷新</button>
          <button style={btn('#f4212e')} onClick={() => setAuthed(false)}>退出</button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: '授权域名', value: domains.length, color: '#1d9bf0' },
          { label: '今日验证', value: logs.filter(l => new Date(l.time).toDateString() === new Date().toDateString()).length, color: '#00ba7c' },
          { label: '今日拒绝', value: logs.filter(l => !l.authorized && new Date(l.time).toDateString() === new Date().toDateString()).length, color: '#f4212e' },
        ].map(s => (
          <div key={s.label} style={{ ...card, textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#8899a6' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 添加域名 */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>➕ 添加授权域名</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...input, flex: 2 }} placeholder="域名（如 myblog.com）" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomain()} />
          <input style={{ ...input, flex: 1 }} placeholder="备注（可选）" value={newNote} onChange={e => setNewNote(e.target.value)} />
          <button style={btn()} onClick={addDomain}>添加</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#8899a6' }}>子域名自动授权，如授权 example.com 则 www.example.com 也生效</p>
      </div>

      {/* 授权域名列表 */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>📋 已授权域名</h2>
        {loading && <p style={{ color: '#8899a6', margin: 0 }}>加载中...</p>}
        {domains.length === 0 && !loading && <p style={{ color: '#8899a6', margin: 0, fontSize: 14 }}>暂无授权域名</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {domains.map(d => (
            <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#1c1f23', borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>🌐</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{d.domain}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#8899a6' }}>{d.note || '无备注'} · 添加于 {new Date(d.addedAt).toLocaleDateString('zh-CN')}</p>
              </div>
              <button onClick={() => removeDomain(d.domain)} style={{ background: 'rgba(244,33,46,0.1)', color: '#f4212e', border: 'none', borderRadius: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}>撤销</button>
            </div>
          ))}
        </div>
      </div>

      {/* 测试验证 */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>🧪 测试域名授权</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...input, flex: 1 }} placeholder="输入域名测试" value={testDomain} onChange={e => setTestDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && doTest()} />
          <button style={btn('#00ba7c')} onClick={doTest}>测试</button>
        </div>
        {testResult && <p style={{ margin: 0, fontSize: 14, color: testResult.valid ? '#00ba7c' : '#f4212e' }}>{testResult.msg}</p>}
      </div>

      {/* 访问日志 */}
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>📊 最近访问日志</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {logs.length === 0 && <p style={{ color: '#8899a6', margin: 0, fontSize: 14 }}>暂无日志</p>}
          {logs.slice(0, 50).map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', background: '#1c1f23', borderRadius: 8, fontSize: 13 }}>
              <span>{l.authorized ? '✅' : '❌'}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{l.domain}</span>
              <span style={{ color: '#8899a6' }}>{new Date(l.time).toLocaleString('zh-CN')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
