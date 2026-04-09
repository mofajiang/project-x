'use client'
import { useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

interface Props {
  onInsertContent: (text: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any

declare global {
  interface Window {
    SpeechRecognition: AnySpeechRecognition
    webkitSpeechRecognition: AnySpeechRecognition
  }
}

export function VoiceInput({ onInsertContent }: Props) {
  const [open, setOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [polishedText, setPolishedText] = useState('')
  const recognitionRef = useRef<AnySpeechRecognition>(null)

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setRecording(false)
    setInterimTranscript('')
  }, [])

  const startRecording = useCallback(() => {
    const SRClass = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SRClass) {
      toast.error('您的浏览器不支持语音识别，请使用 Chrome 或 Edge')
      return
    }

    const recognition = new SRClass()
    recognition.lang = 'zh-CN'
    recognition.continuous = true
    recognition.interimResults = true

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalText += text
        } else {
          interimText += text
        }
      }
      if (finalText) {
        setTranscript((prev) => prev + finalText)
      }
      setInterimTranscript(interimText)
    }

    recognition.onend = () => {
      setRecording(false)
      setInterimTranscript('')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      setRecording(false)
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        toast.error('麦克风权限被拒绝，请在浏览器地址栏允许麦克风访问（需 HTTPS 或 localhost）')
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        toast.error('语音识别错误: ' + event.error)
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setRecording(true)
  }, [])

  const handlePolish = async () => {
    const rawText = transcript.trim()
    if (!rawText) return
    setPolishing(true)
    try {
      const res = await fetch('/api/admin/voice-polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (res.ok && data.polished) {
        setPolishedText(data.polished)
      } else {
        toast.error(data.error || 'AI 整理失败')
      }
    } catch {
      toast.error('AI 整理失败')
    } finally {
      setPolishing(false)
    }
  }

  const handleInsert = () => {
    const text = polishedText || transcript
    if (!text.trim()) return
    onInsertContent(text.trim())
    setOpen(false)
    setTranscript('')
    setPolishedText('')
    setInterimTranscript('')
    toast.success('已插入正文')
  }

  const handleClose = () => {
    stopRecording()
    setOpen(false)
  }

  const currentText = polishedText || transcript

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-4 py-2 text-xs font-medium sm:rounded-full sm:text-sm"
        style={{ background: 'var(--bg)', color: 'var(--accent)', border: '1px solid var(--border)' }}
      >
        🎤 语音输入
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl p-5 shadow-2xl sm:rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            {/* 标题栏 */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                🎤 语音输入
              </h3>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                ✕
              </button>
            </div>

            {/* 录音控制 */}
            <div className="mb-4 flex flex-col items-center gap-2">
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg transition-transform hover:scale-110"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                  title="开始录音"
                >
                  🎤
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg"
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }}
                  title="停止录音"
                >
                  ⏹
                </button>
              )}
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {recording ? '录音中，点击停止' : '点击麦克风开始录音（仅 Chrome / Edge，需允许麦克风权限）'}
              </p>
            </div>

            {/* 转录文本区域 */}
            <div
              className="mb-3 max-h-[180px] min-h-[100px] overflow-y-auto rounded-xl p-3 text-sm"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {transcript || interimTranscript ? (
                <>
                  <span>{transcript}</span>
                  {interimTranscript && (
                    <span style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>{interimTranscript}</span>
                  )}
                </>
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>转录内容将在这里实时显示...</span>
              )}
            </div>

            {/* AI 整理结果 */}
            {polishedText && (
              <div className="mb-3">
                <p className="mb-1 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  ✨ AI 整理结果：
                </p>
                <div
                  className="max-h-[160px] min-h-[60px] overflow-y-auto rounded-xl p-3 text-sm"
                  style={{
                    background: 'rgba(29,155,240,0.06)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {polishedText}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePolish}
                disabled={!transcript.trim() || polishing}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  background: 'var(--bg-hover)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                {polishing ? '整理中...' : '✨ AI 整理'}
              </button>
              <button
                onClick={handleInsert}
                disabled={!currentText.trim()}
                className="flex-1 rounded-xl px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                插入正文
              </button>
              <button
                onClick={() => {
                  setTranscript('')
                  setPolishedText('')
                }}
                className="rounded-xl px-3 py-2 text-sm transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              >
                清空
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
