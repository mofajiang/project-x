import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { execSync } from 'child_process'
import { revalidatePath } from 'next/cache'

const REPO = 'mofajiang/project-x'
const GH = `https://api.github.com/repos/${REPO}`
const HEADERS = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'x-blog-admin' }

function getLocalCommit(): string {
  try { return execSync('git rev-parse HEAD', { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' }).trim() }
  catch { return '' }
}

function getLocalBranch(): string {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' }).trim() }
  catch { return 'main' }
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const localCommit = getLocalCommit()
    const branch = getLocalBranch()

    // 获取远程最新 commit
    const branchRes = await fetch(`${GH}/branches/${branch}`, { headers: HEADERS, cache: 'no-store' })
    if (!branchRes.ok) throw new Error(`GitHub API ${branchRes.status}: ${await branchRes.text()}`)
    const branchData = await branchRes.json()
    const remoteCommit: string = branchData.commit?.sha ?? ''
    const hasUpdate = !!(remoteCommit && localCommit && remoteCommit !== localCommit)

    // 获取新 commits 列表
    let commits: { sha: string; message: string; date: string; author: string }[] = []
    if (hasUpdate) {
      // 用 compare API 精确获取两个 commit 之间的差异
      const compareRes = await fetch(`${GH}/compare/${localCommit}...${remoteCommit}`, { headers: HEADERS, cache: 'no-store' })
      if (compareRes.ok) {
        const cmp = await compareRes.json()
        commits = ((cmp.commits as { sha: string; commit: { message: string; committer: { date: string }; author: { name: string } } }[]) || [])
          .reverse() // 最新的在前
          .slice(0, 20)
          .map(c => ({
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            date: c.commit.committer?.date ?? '',
            author: c.commit.author?.name ?? '',
          }))
      }
    }

    return NextResponse.json({
      hasUpdate,
      localCommit: localCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
      branch,
      commits,
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e), hasUpdate: false }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // 执行 git pull
    const output = execSync('git pull origin main', {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: 'pipe'
    })

    // 重新验证页面缓存
    revalidatePath('/', 'layout')

    return NextResponse.json({
      success: true,
      message: '更新成功',
      output: output.trim()
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: '更新失败',
      error: error.message
    }, { status: 500 })
  }
}