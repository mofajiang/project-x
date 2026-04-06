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
  { value: 'openrouter', label: 'OpenRouter (推荐)', desc: '通过 OpenRouter 接口调用各类 AI 模型' },
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
      const res = await fetch('/api/admin/settings/ai-model')
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

  const handleChange = (field: keyof AiConfig, value: any) => {
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
        toast.success('配置已保存')
      } else {
        toast.error('保存失败')
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
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
        AI 模型管理
      </h1>

      <div className="space-y-8">
        {/* 模型提供商选择 */}
        <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            选择模型提供商
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROVIDERS.map(provider => (
              <button
                key={provider.value}
                onClick={() => handleChange('aiModelProvider', provider.value)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.aiModelProvider === provider.value
                    ? 'border-accent'
                    : 'border-transparent'
                }`}
                style={{
                  background: 'var(--bg-hover)',
                  borderColor: config.aiModelProvider === provider.value ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {provider.label}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {provider.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* OpenRouter 配置 */}
        {config.aiModelProvider === 'openrouter' && (
          <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              OpenRouter 配置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  API Key
                </label>
                <IMEInput
                  type="password"
                  placeholder="输入 OpenRouter API Key"
                  value={config.aiModelApiKey}
                  onValueChange={v => handleChange('aiModelApiKey', v)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noopener noreferrer" className="underline">
                    获取 API Key →
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  模型名称
                </label>
                <IMEInput
                  type="text"
                  placeholder="例如 claude-3.5-sonnet, gpt-4-turbo"
                  value={config.aiModelName}
                  onValueChange={v => handleChange('aiModelName', v)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  填写 OpenRouter 支持的模型全名，如 claude-3.5-sonnet、gpt-4-turbo 等
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 自定义接口配置 */}
        {config.aiModelProvider === 'custom' && (
          <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              自定义接口配置
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  基础 URL
                </label>
                <IMEInput
                  type="url"
                  placeholder="http://localhost:11434"
                  value={config.aiModelBaseUrl}
                  onValueChange={v => handleChange('aiModelBaseUrl', v)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  例如 Ollama: http://localhost:11434
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  模型名称
                </label>
                <IMEInput
                  type="text"
                  placeholder="llama2, mistral, 等"
                  value={config.aiModelName}
                  onValueChange={v => handleChange('aiModelName', v)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  API Key（可选）
                </label>
                <IMEInput
                  type="password"
                  placeholder="留空如果接口不需要认证"
                  value={config.aiModelApiKey}
                  onValueChange={v => handleChange('aiModelApiKey', v)}
                  className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* 高级配置 */}
        <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            高级配置
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                最大 Token 数
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                value={config.aiModelMaxTokens}
                onChange={e => handleChange('aiModelMaxTokens', parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                模型回应的最大长度限制
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                超时时间（秒）
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={config.aiModelTimeout}
                onChange={e => handleChange('aiModelTimeout', parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                请求超时限制
              </p>
            </div>
          </div>
        </div>

        {/* AI 审核设置 */}
        <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            AI 审核设置
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.enableAiDetection}
                onChange={e => handleChange('enableAiDetection', e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                启用 AI 智能审核（用于评论和友链）
              </span>
            </label>

            {config.enableAiDetection && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    审核强度
                  </label>
                  <select
                    value={config.aiReviewStrength}
                    onChange={e => handleChange('aiReviewStrength', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-transparent outline-none border"
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
                    onChange={e => handleChange('aiAutoApprove', e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ color: 'var(--text-primary)' }}>
                    AI 判断安全时自动批准（仅评论；友链始终需人工审核）
                  </span>
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
            className="px-6 py-3 rounded-lg font-bold transition-all"
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
            className="px-8 py-3 rounded-lg font-bold text-white transition-all"
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
