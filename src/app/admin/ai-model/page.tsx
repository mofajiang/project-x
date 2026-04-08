'use client'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { IMEInput } from '@/components/ui/IMEInput'

interface AiConfig {
  enableCustomAiModel: boolean
  aiModelName: string
  aiModelProvider: string
  aiModelBaseUrl: string
  aiModelApiKey: string
  aiModelMaxTokens: number
  aiModelTimeout: number
  enableAiDetection: boolean
  aiReviewStrength: string
  aiAutoApprove: boolean
}

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter（推荐）', desc: '通过 OpenRouter 接口调用各类 AI 模型，免费模型有限速' },
  { value: 'groq', label: 'Groq（免费·极速）', desc: '注册即可使用，每天免费大额度，速度极快，无需 OpenRouter' },
  { value: 'custom', label: '自定义接口', desc: '运行自己部署的 AI 服务（如 Ollama、LocalAI 等）' },
]

export default function AdminAiModelPage() {
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings/ai-model', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      } else {
        const error = await res.json()
        toast.error(error.error || '加载配置失败')
      }
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof AiConfig, value: string | number | boolean) => {
    if (config) {
      setConfig({ ...config, [field]: value })
    }
  }

  const handleSave = async () => {
    if (!config) return

    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings/ai-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (res.ok) {
        const savedConfig = await res.json()
        setConfig(savedConfig)
        toast.success('配置已保存')
      } else {
        const err = await res.json()
        toast.error(err?.error || '保存失败')
      }
    } catch {
      toast.error('网络错误')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!config?.aiModelApiKey) {
      toast.error('请先填写 API Key')
      return
    }

    setTestingConnection(true)
    try {
      const res = await fetch('/api/admin/settings/ai-model/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.aiModelProvider,
          baseUrl: config.aiModelBaseUrl,
          apiKey: config.aiModelApiKey,
          model: config.aiModelName,
          timeout: config.aiModelTimeout,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success('连接成功！')
      } else {
        toast.error(data.error || '连接失败')
      }
    } catch (error) {
      toast.error('测试出错')
    } finally {
      setTestingConnection(false)
    }
  }

  if (loading) {
    return <div style={{ color: 'var(--text-secondary)' }}>加载中...</div>
  }

  if (!config) {
    return <div style={{ color: 'var(--text-secondary)' }}>无法加载配置</div>
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-8 text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
        AI 模型管理
      </h1>

      <div className="space-y-8">
        {/* 模型提供商选择 */}
        <div
          className="rounded-2xl border p-6"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            选择模型提供商
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.value}
                onClick={() => handleChange('aiModelProvider', provider.value)}
                className={`rounded-xl border-2 p-4 text-left transition-all ${
                  config.aiModelProvider === provider.value ? 'border-accent' : 'border-transparent'
                }`}
                style={{
                  background: 'var(--bg-hover)',
                  borderColor: config.aiModelProvider === provider.value ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {provider.label}
                </p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {provider.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* OpenRouter 配置 */}
        {config.aiModelProvider === 'openrouter' && (
          <div
            className="rounded-2xl border p-6"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              OpenRouter 配置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  API Key
                </label>
                <IMEInput
                  type="password"
                  placeholder="输入 OpenRouter API Key"
                  value={config.aiModelApiKey}
                  onValueChange={(v) => handleChange('aiModelApiKey', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <a
                    href="https://openrouter.ai/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    获取 API Key →
                  </a>
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  模型名称
                </label>
                <IMEInput
                  type="text"
                  placeholder="例如 anthropic/claude-3.5-sonnet 或 google/gemma-2-9b-it:free"
                  value={config.aiModelName}
                  onValueChange={(v) => handleChange('aiModelName', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  格式：<code className="font-mono">提供商/模型名</code>，如{' '}
                  <code className="font-mono">anthropic/claude-3.5-sonnet</code>、
                  <code className="font-mono">openai/gpt-4o-mini</code>。 ⚠️ 带 <code className="font-mono">:free</code>{' '}
                  的免费模型受上游限速影响，频繁调用时易出现 429 错误。
                  <a
                    href="https://openrouter.ai/models"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline"
                  >
                    查看所有模型 →
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Groq 配置 */}
        {config.aiModelProvider === 'groq' && (
          <div
            className="rounded-2xl border p-6"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Groq 配置
            </h2>
            <div
              className="mb-4 rounded-lg px-4 py-3 text-sm"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--text-primary)' }}
            >
              💡 Groq 提供<strong>免费</strong>的 Llama / Mixtral
              等模型，速度极快，注册即可使用，每天有慷慨免费额度，无需绑定信用卡。
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 underline"
              >
                获取 Groq API Key →
              </a>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  API Key
                </label>
                <IMEInput
                  type="password"
                  placeholder="输入 Groq API Key（gsk_...）"
                  value={config.aiModelApiKey}
                  onValueChange={(v) => handleChange('aiModelApiKey', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  模型名称
                </label>
                <select
                  value={config.aiModelName}
                  onChange={(e) => handleChange('aiModelName', e.target.value)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="llama-3.1-8b-instant">llama-3.1-8b-instant（推荐，最快）</option>
                  <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile（更准确）</option>
                  <option value="gemma2-9b-it">gemma2-9b-it（Google Gemma 2）</option>
                  <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 自定义接口配置 */}
        {config.aiModelProvider === 'custom' && (
          <div
            className="rounded-2xl border p-6"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
          >
            <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              自定义接口配置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  基础 URL
                </label>
                <IMEInput
                  type="url"
                  placeholder="http://localhost:11434"
                  value={config.aiModelBaseUrl}
                  onValueChange={(v) => handleChange('aiModelBaseUrl', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  例如 Ollama: http://localhost:11434
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  模型名称
                </label>
                <IMEInput
                  type="text"
                  placeholder="llama2, mistral, 等"
                  value={config.aiModelName}
                  onValueChange={(v) => handleChange('aiModelName', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  API Key（可选）
                </label>
                <IMEInput
                  type="password"
                  placeholder="留空如果接口不需要认证"
                  value={config.aiModelApiKey}
                  onValueChange={(v) => handleChange('aiModelApiKey', v)}
                  className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 高级配置 */}
        <div
          className="rounded-2xl border p-6"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            高级配置
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                最大 Token 数
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                value={isNaN(config.aiModelMaxTokens) ? '' : config.aiModelMaxTokens}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  handleChange('aiModelMaxTokens', isNaN(v) ? 2000 : v)
                }}
                className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                模型回应的最大长度限制
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                超时时间（秒）
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={isNaN(config.aiModelTimeout) ? '' : config.aiModelTimeout}
                onChange={(e) => {
                  const v = parseInt(e.target.value)
                  handleChange('aiModelTimeout', isNaN(v) ? 30 : v)
                }}
                className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                请求超时限制
              </p>
            </div>
          </div>
        </div>

        {/* AI 审核设置 */}
        <div
          className="rounded-2xl border p-6"
          style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
        >
          <h2 className="mb-4 text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            AI 审核设置
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.enableAiDetection}
                onChange={(e) => handleChange('enableAiDetection', e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>启用 AI 智能审核（用于评论和友链）</span>
            </label>

            {config.enableAiDetection && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    审核强度
                  </label>
                  <select
                    value={config.aiReviewStrength}
                    onChange={(e) => handleChange('aiReviewStrength', e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-4 py-2 outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option value="lenient">宽松 - 较少拦截，可能漏过一些违规</option>
                    <option value="balanced">均衡 - 推荐使用</option>
                    <option value="strict">严格 - 较严格审核，可能误杀</option>
                  </select>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.aiAutoApprove}
                    onChange={(e) => handleChange('aiAutoApprove', e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>AI 判断安全时自动批准（评论和友链）</span>
                </label>
              </>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-4">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection || saving}
            className="rounded-lg px-6 py-3 font-bold transition-all"
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              opacity: testingConnection || saving ? 0.5 : 1,
            }}
          >
            {testingConnection ? '测试中...' : '测试连接'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-8 py-3 font-bold text-white transition-all"
            style={{
              background: 'var(--accent)',
              opacity: saving ? 0.5 : 1,
            }}
          >
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>
    </div>
  )
}
