'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IMEInput } from '@/components/ui/IMEInput'
import {
  ADMIN_CARD_CLASS,
  ADMIN_PAGE_TITLE_CLASS,
  ADMIN_SECTION_TITLE,
  ADMIN_BTN_PRIMARY,
  ADMIN_INPUT_CLASS,
} from '@/components/admin/adminUi'

export default function SmtpPage() {
  const [smtp, setSmtp] = useState({ SMTP_HOST: '', SMTP_PORT: '465', SMTP_USER: '', SMTP_PASS: '', SMTP_FROM: '' })
  const [configured, setConfigured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch('/api/admin/smtp', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSmtp({
            SMTP_HOST: data.SMTP_HOST || '',
            SMTP_PORT: data.SMTP_PORT || '465',
            SMTP_USER: data.SMTP_USER || '',
            SMTP_PASS: data.SMTP_PASS || '',
            SMTP_FROM: data.SMTP_FROM || '',
          })
          setConfigured(data.configured || false)
          setTestEmail(data.SMTP_USER || '')
        }
      })
  }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/admin/smtp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(smtp),
    })
    setSaving(false)
    if (res.ok) {
      const data = await res.json()
      setSmtp({
        SMTP_HOST: data.SMTP_HOST || '',
        SMTP_PORT: data.SMTP_PORT || '465',
        SMTP_USER: data.SMTP_USER || '',
        SMTP_PASS: data.SMTP_PASS || '',
        SMTP_FROM: data.SMTP_FROM || '',
      })
      setConfigured(!!data.configured)
      setTestEmail(data.SMTP_USER || '')
      toast.success('SMTP 配置已保存，重启服务后生效')
    } else {
      const d = await res.json()
      toast.error(d.error || '保存失败')
    }
  }

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast.error('请填写收件人邮箱')
      return
    }
    setTesting(true)
    const res = await fetch('/api/admin/smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail }),
    })
    setTesting(false)
    if (res.ok) toast.success('测试邮件已发送，请检查收件箱')
    else {
      const d = await res.json()
      toast.error(d.error || '发送失败')
    }
  }

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    type?: string
  }) => (
    <div>
      <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <IMEInput
        type={type}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder}
        className={ADMIN_INPUT_CLASS}
        style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
      />
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className={ADMIN_PAGE_TITLE_CLASS} style={{ color: 'var(--text-primary)' }}>
        SMTP 邮件
      </h1>
      <div className={`${ADMIN_CARD_CLASS} mb-4 sm:mb-6`} style={{ background: 'var(--bg-secondary)' }}>
        <h2 className={`${ADMIN_SECTION_TITLE} mb-4`} style={{ color: 'var(--text-primary)' }}>
          SMTP 配置
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="SMTP 服务器"
            value={smtp.SMTP_HOST}
            onChange={(v) => setSmtp((s) => ({ ...s, SMTP_HOST: v }))}
            placeholder="smtp.example.com"
          />
          <Field
            label="端口"
            value={smtp.SMTP_PORT}
            onChange={(v) => setSmtp((s) => ({ ...s, SMTP_PORT: v }))}
            placeholder="465"
          />
          <Field
            label="用户名"
            value={smtp.SMTP_USER}
            onChange={(v) => setSmtp((s) => ({ ...s, SMTP_USER: v }))}
            placeholder="your-email@example.com"
          />
          <Field
            label="密码"
            value={smtp.SMTP_PASS}
            onChange={(v) => setSmtp((s) => ({ ...s, SMTP_PASS: v }))}
            placeholder="your-password"
            type="password"
          />
          <div className="sm:col-span-2">
            <Field
              label="发件人邮箱"
              value={smtp.SMTP_FROM}
              onChange={(v) => setSmtp((s) => ({ ...s, SMTP_FROM: v }))}
              placeholder="noreply@example.com"
            />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className={`${ADMIN_BTN_PRIMARY} mt-6`}
          style={{ background: 'var(--accent)' }}
        >
          {saving ? '保存中...' : '保存配置'}
        </button>
      </div>

      {configured && (
        <div className={ADMIN_CARD_CLASS} style={{ background: 'var(--bg-secondary)' }}>
          <h2 className={`${ADMIN_SECTION_TITLE} mb-4`} style={{ color: 'var(--text-primary)' }}>
            测试邮件
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <IMEInput
              value={testEmail}
              onValueChange={setTestEmail}
              placeholder="收件人邮箱"
              className={ADMIN_INPUT_CLASS}
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid transparent' }}
            />
            <button
              onClick={sendTest}
              disabled={testing}
              className={ADMIN_BTN_PRIMARY}
              style={{ background: 'var(--accent)' }}
            >
              {testing ? '发送中...' : '发送测试'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
