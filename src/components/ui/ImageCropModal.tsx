'use client'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'

interface Area {
  x: number
  y: number
  width: number
  height: number
}

// react-easy-crop types mark many defaulted props as required, use type assertion for dynamic import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Cropper = dynamic(() => import('react-easy-crop').then((mod) => mod.default) as any, {
  ssr: false,
}) as React.ComponentType<{
  image: string
  crop: { x: number; y: number }
  zoom: number
  aspect: number
  cropShape: 'rect' | 'round'
  showGrid: boolean
  onCropChange: (location: { x: number; y: number }) => void
  onZoomChange: (zoom: number) => void
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void
}>
import React from 'react'

async function getCroppedBlob(imageSrc: string, croppedArea: Area, size = 400): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, croppedArea.x, croppedArea.y, croppedArea.width, croppedArea.height, 0, 0, size, size)
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/jpeg', 0.92)
  })
}

interface Props {
  src: string // 原始图片 objectURL
  aspect?: number // 裁剪比例，默认 1（正方形）
  outputSize?: number // 输出像素，默认 400
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export default function ImageCropModal({ src, aspect = 1, outputSize = 400, onConfirm, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)
  const [confirming, setConfirming] = useState(false)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedArea) return
    setConfirming(true)
    try {
      const blob = await getCroppedBlob(src, croppedArea, outputSize)
      onConfirm(blob)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-3xl p-5"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            ✂️ 裁剪头像
          </h3>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        {/* 裁剪区域 */}
        <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: 300, background: '#111' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* 缩放滑块 */}
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            🔍
          </span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
          <span className="w-10 text-right text-xs" style={{ color: 'var(--text-secondary)' }}>
            {zoom.toFixed(1)}x
          </span>
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
          拖动调整位置，滑动缩放，裁剪为 {outputSize}×{outputSize} 正方形
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl py-2.5 text-sm font-medium"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || !croppedArea}
            className="flex-1 rounded-2xl py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {confirming ? '处理中...' : '确认裁剪'}
          </button>
        </div>
      </div>
    </div>
  )
}
