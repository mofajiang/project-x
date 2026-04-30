'use client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * Returns an async logout function that calls the logout API, shows a toast,
 * then either pushes to redirectPath or refreshes the current route.
 */
export function useLogout(redirectPath?: string) {
  const router = useRouter()
  return async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('已退出登录')
    if (redirectPath) {
      router.push(redirectPath)
    } else {
      router.refresh()
    }
  }
}
