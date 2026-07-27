import { useEffect, useState } from 'react'
import { getAllUserWords, getDailyStats } from '../lib/firestore'
import type { WordState } from '../lib/firestore'
import { loadDB } from '../lib/worddb'
import { getCurrentUid } from '../lib/auth'
import ActivityHeatmap from '../components/ActivityHeatmap'
import LifecycleChart from '../components/LifecycleChart'
import RetentionChart from '../components/RetentionChart'
import DueSummary from '../components/DueSummary'
import LeechPanel from '../components/LeechPanel'

interface DashboardData {
  dailyCounts: { date: string; count: number }[]
  statusCounts: Record<string, number>
  retention: { date: string; rate: number }[]
  dueCount: number
  newCount: number
  leeches: { simplified: string; pinyin: string; definition: string }[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const uid = getCurrentUid()
    if (!uid) return
    try {
      const [allWords, worddb, dailyCounts] = await Promise.all([
        getAllUserWords(uid),
        loadDB(),
        getDailyStats(uid, 365),
      ])

      const now = new Date()
      const statusCounts: Record<string, number> = {
        Unstudied: 0, Weak: 0, Strong: 0, Memorized: 0, Mastered: 0, Leech: 0,
      }
      let dueCount = 0
      const leeches: DashboardData['leeches'] = []

      for (const w of allWords) {
        statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1
        if (w.nextReviewDate <= now && w.status !== 'Mastered' && w.status !== 'Leech' && w.status !== 'Unstudied') {
          dueCount++
        }
        if (w.status === 'Leech') {
          const wordData = worddb.getWord(w.simplified)
          leeches.push({
            simplified: w.simplified,
            pinyin: wordData?.pinyin ?? w.customWordData?.pinyin ?? '',
            definition: wordData?.definition ?? w.customWordData?.definition ?? '',
          })
        }
      }

      const totalWords = worddb.getAllWords().length
      const studiedCount = allWords.filter((w: WordState) => w.status !== 'Unstudied').length
      statusCounts['Unstudied'] = Math.max(0, totalWords - studiedCount)

      // Retention comes from the same 365-day dailyStats fetch as the heatmap — no extra reads.
      // Days with no reviews, or written before `correctCount` existed, are omitted rather than
      // plotted at 0%, which also keeps NaN out of the Recharts series.
      const retentionCutoff = new Date()
      retentionCutoff.setDate(retentionCutoff.getDate() - 30)
      const retentionCutoffStr = retentionCutoff.toISOString().slice(0, 10)
      const retention = dailyCounts
        .filter((d) => d.date >= retentionCutoffStr && d.totalReviewed > 0 && d.hasCorrectCount)
        .map((d) => ({
          date: d.date,
          rate: Math.round((d.correctCount / d.totalReviewed) * 100),
        }))

      setData({
        dailyCounts,
        statusCounts,
        retention,
        dueCount,
        newCount: Math.max(0, totalWords - studiedCount),
        leeches,
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => { load() }, [])

  if (error) return <div className="p-8 text-incorrect">{error}</div>
  if (!data) return <div className="p-8 text-text-muted">Loading…</div>

  return (
    <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>

      <DueSummary dueCount={data.dueCount} newCount={data.newCount} leechCount={data.leeches.length} />

      <section>
        <h2 className="text-lg font-semibold text-text-primary mb-3">Study Activity</h2>
        <ActivityHeatmap data={data.dailyCounts} />
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Vocabulary Progress</h2>
          <LifecycleChart statusCounts={data.statusCounts} />
        </section>
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Retention Rate</h2>
          <RetentionChart data={data.retention} />
        </section>
      </div>

      {data.leeches.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Leeches ({data.leeches.length})</h2>
          <LeechPanel leeches={data.leeches} onUpdate={load} />
        </section>
      )}
    </div>
  )
}
