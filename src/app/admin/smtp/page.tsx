'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IMEInput } from '@/components/ui/IMEInput'

export default function SmtpPage() {
  const [smtp, setSmtp] = useState({ SMTP_HOST: '', SMTP_PORT: '465', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '' })
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/smtp').then(r => r.json()).then(data => {
      if (data) {
        setSmtp({ SMTP_HOST: data.SMTP_HOST || '', SMTP_PORT: data.SMTP_PORT || '465', SMTP_USER: data.SMTP_USER || '', SMTP_PASS: data.SMTP_PASS || '', SMTP_FROM: data.SMTP_FROM || '' })
        setConfigured(data.configured || false)
        setTestEmail(data.SMTP_USER || '')
      }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/smtp', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(smtp) })
    setSaving(false)
    if (res.ok) {
      toast.success('SMTP 配置已保存，重启服务后生�?)
      setConfigured(!!(smtp.SMTP_HOST && smtp.SMTP_USER && smtp.SMTP_PASS))
    } else {
      const d = await res.json()
      toast.error(d.error || '保存失败')
    }
  }

  const sendTest = async () => {
    if (!testEmail.trim()) { toast.error('请填写收件人邮箱'); return }
    setTesting(true)
    const res = await fetch('/api/admin/smtp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: testEmail }) })
    setTesting(false)
    if (res.ok) toast.success('测试邮件已发送，请检查收件箱')
    else { const d = await res.json(); toast.error(d.error || '发送失�?) }
  }

  const Field = ({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <IMEInput type={type} value={value} onValueChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none"
        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }} />
    </div>
  )

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>📧 邮件通知</h1>
        {configured && (
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: 'rgba(0,186,124,0.12)', color: '#00ba7c' }}>�?已配�?/span>
        )}
      </div>

      {/* SMTP 配置 */}
      <div className="rounded-2xl p-6 mb-6 flex flex-col gap-4" style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>SMTP 服务器配�?/h2>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>配置后，评论审核通过或被回复时将自动发邮件提醒访客。留空则禁用邮件功能�?/p>
        <Field label="SMTP 服务�? value={smtp.SMTP_HOST} onChange={v => setSmtp(s => ({ ...s, SMTP_HOST: v }))} placeholder="smtp.qq.com" />
        <Field label="端口" value={smtp.SMTP_PORT} onChange={v => setSmtp(s => ({ ...s, SMTP_PORT: v }))} placeholder="465" />
        <Field label="账号（发件人邮箱�? value={smtp.SMTP_USER} onChange={v => setSmtp(s => ({ ...s, SMTP_USER: v }))} placeholder="you@qq.com" />
        <Field label="密码 / 授权�? value={smtp.SMTP_PASS} onChange={v => setSmtp(s => ({ ...s, SMTP_PASS: v }))} placeholder="留空则不修改" type="password" />
        <Field label="发件人显示名称（选填�? value={smtp.SMTP_FROM} onChange={v => setSmtp(s => ({ ...s, SMTP_FROM: v }))} placeholder="留空则使用账号邮�? />
        <button onClick={save} disabled={saving}
          className="self-start px-6 py-2 rounded-full text-sm font-bold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}>
          {saving ? '保存�?..' : '保存配置'}
        </button>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>修改 .env 后需重启服务生效�?code className="px-1 py-0.5 rounded" style={{ background: 'var(--bg)' }}>pm2 restart myblog</code></p>
      </div>

      {/* 常见服务�?*/}
      <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>常见服务商参�?/h2>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-secondary)' }}>
              <th className="text-left pb-2 font-medium">服务�?/th>
              <th className="text-left pb-2 font-medium">SMTP 服务�?/th>
              <th className="text-left pb-2 font-medium">端口</th>
            </tr>
          </thead>
          <tbody style={{ color: 'var(--text-primary)' }}>
            {[
              ['QQ 邮箱', 'smtp.qq.com', '465'],
              ['163 邮箱', 'smtp.163.com', '465'],
              ['Gmail', 'smtp.gmail.com', '587'],
              ['Outlook', 'smtp.office365.com', '587'],
              ['阿里云企业邮', 'smtp.qiye.aliyun.com', '465'],
            ].map(([name, host, port]) => (
              <tr key={name} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-2">{name}</td>
                <td className="py-2 font-mono text-xs" style={{ color: 'var(--accent)' }}>{host}</td>
                <td className="py-2">{port}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 测试发�?*/}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-secondary)' }}>
        <h2 className="font-bold mb-3" style={{ color: 'var(--text-primary)' }}>发送测试邮�?/h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>保存配置后，发一封测试邮件验证是否配置正确�?/p>
        <div className="flex gap-2">
          <IMEInput
            type="email"
            value={testEmail}
            onValueChange={setTestEmail}
            placeholder="收件人邮�?
            className="flex-1 px-3 py-2 rounded-2xl text-sm outline-none"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
          />
          <button onClick={sendTest} disabled={testing}
            className="px-5 py-2 rounded-full text-sm font-bold disabled:opacity-50 flex-shrink-0 transition-colors hover:opacity-90"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            {testing ? '发送中...' : '发测试邮�?}
          </button>
        </div>
      </div>
    </div>
  )
}
