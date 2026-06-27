import { resetLeech, suspendWord, deleteWord } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'

interface Leech {
  simplified: string
  pinyin: string
  definition: string
}

interface Props {
  leeches: Leech[]
  onUpdate: () => void
}

export default function LeechPanel({ leeches, onUpdate }: Props) {
  const uid = getCurrentUid()

  async function reset(simplified: string) {
    if (!uid) return
    await resetLeech(uid, simplified)
    onUpdate()
  }

  async function suspend(simplified: string) {
    if (!uid) return
    await suspendWord(uid, simplified)
    onUpdate()
  }

  async function remove(simplified: string) {
    if (!uid) return
    await deleteWord(uid, simplified)
    onUpdate()
  }

  return (
    <div className="space-y-2">
      {leeches.map((leech) => (
        <div key={leech.simplified} className="flex items-center gap-4 bg-incorrect/5 border border-incorrect/20 rounded-xl px-4 py-3">
          <span className="text-2xl text-text-primary">{leech.simplified}</span>
          <span className="text-sm text-text-muted">{leech.pinyin}</span>
          <span className="text-sm text-text-muted flex-1 truncate">{leech.definition}</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => reset(leech.simplified)} className="text-xs px-2 py-1 border border-correct/50 text-correct rounded-lg hover:bg-correct/10">Reset</button>
            <button onClick={() => suspend(leech.simplified)} className="text-xs px-2 py-1 border border-border text-text-muted rounded-lg hover:bg-surface">Suspend</button>
            <button onClick={() => remove(leech.simplified)} className="text-xs px-2 py-1 border border-incorrect/50 text-incorrect rounded-lg hover:bg-incorrect/10">Delete</button>
          </div>
        </div>
      ))}
    </div>
  )
}
