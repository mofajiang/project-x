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
    // 保留 ASCII 字母/数字、中日韩字符、空格和连字符，移除其余字符
    .replace(/[^\w\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatViews(views: number) {
  if (views >= 10000) return `${(views / 10000).toFixed(1)}万`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}k`
  return views.toString()
}
