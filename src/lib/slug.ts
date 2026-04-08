export function buildSlugCandidates(input: string) {
  const set = new Set<string>()
  const raw = (input || '').trim()
  if (!raw) return []

  set.add(raw)
  try { set.add(decodeURIComponent(raw)) } catch {}
  try { set.add(encodeURIComponent(raw)) } catch {}

  for (const value of Array.from(set)) {
    set.add(value.normalize('NFC'))
    set.add(value.normalize('NFD'))
  }

  return Array.from(set).filter(Boolean)
}
