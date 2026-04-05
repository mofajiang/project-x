import { clsx, type ClassValue } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function relativeTime(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
}

export function formatDate(date: Date | string) {
  return format(new Date(date), 'yyyy年MM月dd日', { locale: zhCN })
}

export function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')  // 保留 Unicode 字母/数字（含中文），移除其余标点
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatViews(views: number) {
  if (views >= 10000) return `${(views / 10000).toFixed(1)}万`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}k`
  return views.toString()
}
