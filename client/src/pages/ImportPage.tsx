import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { loadDB } from '../lib/worddb'
import { importWordsToFirestore } from '../lib/firestore'
import { getCurrentUid } from '../lib/auth'
import type { ReviewState } from '../lib/srs'

interface ParsedRow {
  simplified: string
  state: ReviewState & { status: string; deckName: string }
  customWordData?: { simplified: string; traditional: string | null; pinyin: string; definition: string }
}

interface PreviewData {
  total: number
  countByStatus: Record<string, number>
  errors: { line: number; message: string }[]
  rows: ParsedRow[]
}

interface ConfirmResult {
  imported: number
  errors: number
}

const STATUS_MAP: Record<string, string> = {
  Unstudied: 'Unstudied',
  Weak: 'Weak',
  Strong: 'Strong',
  Memorized: 'Memorized',
  Mastered: 'Mastered',
}

function deriveInterval(status: string, nextReview: string, importDate: Date): number {
  const caps: Record<string, number> = { Weak: 7, Strong: 21, Memorized: 180 }
  const cap = caps[status]
  if (!cap) return 0
  const next = new Date(nextReview)
  if (Number.isNaN(next.getTime())) return 1
  return Math.min(Math.max(1, (next.getTime() - importDate.getTime()) / 86400000), cap)
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)

  async function handlePreview(f: File) {
    setLoading(true)
    setError(null)
    setPreview(null)
    setResult(null)

    try {
      const worddb = await loadDB()
      const importDate = new Date()

      const parsed = await new Promise<Papa.ParseResult<Record<string, string>>>((resolve) => {
        Papa.parse(f, { header: true, skipEmptyLines: true, complete: resolve })
      })

      const requiredCols = ['Simplified', 'Pinyin', 'Definitions', 'List Name', 'Status', 'Next Review']
      const missing = requiredCols.filter((c) => !parsed.meta.fields?.includes(c))
      if (missing.length > 0) throw new Error(`Missing required columns: ${missing.join(', ')}`)

      const errors: { line: number; message: string }[] = []
      const countByStatus: Record<string, number> = {}
      const rows: ParsedRow[] = []

      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i]
        const simplified = row['Simplified']?.trim()
        if (!simplified) { errors.push({ line: i + 2, message: 'Missing Simplified field' }); continue }

        const rawStatus = row['Status']?.trim() ?? ''
        const status = STATUS_MAP[rawStatus] ?? 'Unstudied'
        const interval = status === 'Mastered' ? 365 : deriveInterval(status, row['Next Review'] ?? '', importDate)
        const nextReviewDate = new Date()
        nextReviewDate.setDate(nextReviewDate.getDate() + (interval > 0 ? interval : 0))

        const state: ReviewState & { status: string; deckName: string } = {
          intervalMeaning: interval,
          intervalPinyin: interval,
          intervalAudio: interval,
          easeFactor: 2.5,
          consecutiveFails: 0,
          nextReviewDate,
          lastSubskill: null,
          status,
          deckName: row['List Name']?.trim() || 'Imported',
        }

        countByStatus[status] = (countByStatus[status] ?? 0) + 1

        const inDb = worddb.getWord(simplified)
        rows.push({
          simplified,
          state,
          ...(!inDb
            ? {
                customWordData: {
                  simplified,
                  traditional: row['Traditional']?.trim() || null,
                  pinyin: row['Pinyin']?.trim() ?? '',
                  definition: row['Definitions']?.trim() ?? '',
                },
              }
            : {}),
        })
      }

      setPreview({ total: rows.length, countByStatus, errors, rows })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    const uid = getCurrentUid()
    if (!uid) { setError('Not signed in'); return }

    setLoading(true)
    setError(null)
    setProgressMsg(null)

    try {
      const { imported } = await importWordsToFirestore(
        uid,
        preview.rows,
        (batch, total) => setProgressMsg(`Writing batch ${batch} of ${total}…`)
      )
      setResult({ imported, errors: preview.errors.length })
      setPreview(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setProgressMsg(null)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Import from Hack Chinese</h1>
      <p className="text-text-muted text-sm">
        Export your vocabulary from Hack Chinese (Account → Export), then upload the CSV here.
      </p>

      {!preview && !result && (
        <div
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) handlePreview(f)
          }}
          onClick={() => fileRef.current?.click()}
        >
          <p className="text-4xl mb-3">📥</p>
          <p className="text-text-primary font-medium">Drop your CSV here or click to browse</p>
          <p className="text-text-muted text-sm mt-1">Hack Chinese export format (.csv)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePreview(f) }}
          />
        </div>
      )}

      {loading && <p className="text-text-muted text-center">{progressMsg ?? 'Processing…'}</p>}
      {error && <p className="text-incorrect bg-incorrect/10 rounded-lg p-3 text-sm">{error}</p>}

      {preview && (
        <div className="space-y-4">
          <div className="bg-surface-raised rounded-xl p-5 border border-border">
            <h2 className="font-semibold text-text-primary mb-3">Preview</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-accent">{preview.total}</p>
                <p className="text-xs text-text-muted">Total words</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-correct">{preview.total - preview.errors.length}</p>
                <p className="text-xs text-text-muted">Ready to import</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-incorrect">{preview.errors.length}</p>
                <p className="text-xs text-text-muted">Errors</p>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              {Object.entries(preview.countByStatus).map(([status, count]) =>
                count > 0 ? (
                  <div key={status} className="flex justify-between text-sm">
                    <span className="text-text-muted">{status}</span>
                    <span className="text-text-primary font-medium">{count}</span>
                  </div>
                ) : null
              )}
            </div>
            {preview.errors.length > 0 && (
              <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
                {preview.errors.map((e, i) => (
                  <p key={i} className="text-xs text-incorrect">Line {e.line}: {e.message}</p>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 py-3 bg-accent text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Confirm Import
            </button>
            <button
              onClick={() => setPreview(null)}
              className="px-6 py-3 border border-border rounded-xl text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-correct/10 border border-correct/30 rounded-xl p-5 space-y-2">
          <p className="text-correct font-semibold">Import complete!</p>
          <p className="text-sm text-text-muted">Imported: <span className="text-text-primary font-medium">{result.imported}</span></p>
          {result.errors > 0 && <p className="text-sm text-incorrect">{result.errors} rows had errors</p>}
          <button onClick={() => setResult(null)} className="mt-2 text-sm text-accent hover:underline">
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}
