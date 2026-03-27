import { NextRequest, NextResponse } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { execSync } from 'child_process'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 获取当前commit hash
    const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()

    // 获取远程最新commit hash
    try {
      execSync('git fetch origin', { stdio: 'pipe' })
    } catch (fetchError) {
      console.warn('Git fetch failed:', fetchError)
    }

    let remoteCommit = currentCommit
    try {
      remoteCommit = execSync('git rev-parse origin/main', { encoding: 'utf8' }).trim()
    } catch (remoteError) {
      console.warn('Failed to get remote commit:', remoteError)
      // 如果获取远程失败，使用当前commit
    }

    // 检查是否有未推送的本地提交
    let localCommits = ''
    let hasLocalCommits = false
    try {
      localCommits = execSync('git log origin/main..HEAD --oneline', { encoding: 'utf8' }).trim()
      hasLocalCommits = localCommits.length > 0
    } catch (localError) {
      console.warn('Failed to check local commits:', localError)
    }

    // 检查是否有未拉取的远程更新
    let remoteUpdates = ''
    let hasRemoteUpdates = false
    try {
      remoteUpdates = execSync('git log HEAD..origin/main --oneline', { encoding: 'utf8' }).trim()
      hasRemoteUpdates = remoteUpdates.length > 0
    } catch (remoteUpdateError) {
      console.warn('Failed to check remote updates:', remoteUpdateError)
    }

    return NextResponse.json({
      currentCommit: currentCommit.substring(0, 7),
      remoteCommit: remoteCommit.substring(0, 7),
      isUpToDate: currentCommit === remoteCommit && !hasLocalCommits,
      hasLocalCommits,
      hasRemoteUpdates,
      localCommitsCount: hasLocalCommits ? localCommits.split('\n').filter(line => line.trim()).length : 0,
      remoteUpdatesCount: hasRemoteUpdates ? remoteUpdates.split('\n').filter(line => line.trim()).length : 0,
    })
  } catch (error) {
    console.error('Version check error:', error)
    // 返回一个基本的响应，即使git命令失败
    return NextResponse.json({
      currentCommit: 'unknown',
      remoteCommit: 'unknown',
      isUpToDate: true,
      hasLocalCommits: false,
      hasRemoteUpdates: false,
      localCommitsCount: 0,
      remoteUpdatesCount: 0,
      error: 'Git command failed'
    })
  }
}