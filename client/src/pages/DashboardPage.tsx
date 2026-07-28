import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllUserWords, getDailyStats, getProfile, normalizeLastRead } from '../lib/firestore'
import type { LastReadPosition, WordState } from '../lib/firestore'
import { loadDB } from '../lib/worddb'
import { getCurrentUid } from '../lib/auth'
import {
  computeActivityTotals,
  computeForecast,
  computeHskProgress,
  computeSkillSplit,
  computeStreak,
  computeVelocity,
  isScheduled,
} from '../lib/dashboardStats'
import type {
  ActivityTotals,
  ForecastBucket,
  HskLevelProgress,
  SkillSplitData,
  Streak,
  VelocityWeek,
} from '../lib/dashboardStats'
import { recommend } from '../lib/recommendations'
import type { Recommendation } from '../lib/recommendations'
import ActivityHeatmap from '../components/ActivityHeatmap'
import DashboardCard from '../components/DashboardCard'
import DueSummary from '../components/DueSummary'
import ForecastChart from '../components/ForecastChart'
import HskProgress from '../components/HskProgress'
import LeechPanel from '../components/LeechPanel'
import LearningVelocityChart from '../components/LearningVelocityChart'
import LifecycleChart from '../components/LifecycleChart'
import NextUpPanel from '../components/NextUpPanel'
import RetentionChart from '../components/RetentionChart'
import SkillSplit from '../components/SkillSplit'
import StatTile from '../components/StatTile'

interface DashboardData {
  dailyCounts: { date: string; count: number }[]
  statusCounts: Record<string, number>
  retention: { date: string; rate: number }[]
  dueCount: number
  newCount: number
  studiedCount: number
  leeches: { simplified: string; pinyin: string; definition: string }[]
  streak: Streak
  activity: ActivityTotals
  forecast: ForecastBucket[]
  skillSplit: SkillSplitData | null
  hskProgress: HskLevelProgress[]
  velocity: VelocityWeek[]
  recommendations: Recommendation[]
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const uid = getCurrentUid()
    if (!uid) return
    try {
      // Three reads, once. Every statistic below is a fold over these results —
      // adding one must never add a query.
      const [allWords, worddb, dailyStats, profile] = await Promise.all([
        getAllUserWords(uid),
        loadDB(),
        getDailyStats(uid, 365),
        getProfile(uid),
      ])

      const now = new Date()
      const statusCounts: Record<string, number> = {
        Unstudied: 0, Weak: 0, Strong: 0, Memorized: 0, Mastered: 0, Leech: 0,
      }
      let dueCount = 0
      const leeches: DashboardData['leeches'] = []

      for (const w of allWords) {
        statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1
        if (w.nextReviewDate <= now && isScheduled(w)) dueCount++
        if (w.status === 'Leech') {
          const wordData = worddb.getWord(w.simplified)
          leeches.push({
            simplified: w.simplified,
            pinyin: wordData?.pinyin ?? w.customWordData?.pinyin ?? '',
            definition: wordData?.definition ?? w.customWordData?.definition ?? '',
          })
        }
      }

      const dbWords = worddb.getAllWords()
      const studiedSimplifieds = new Set(
        allWords.filter((w: WordState) => w.status !== 'Unstudied').map((w) => w.simplified)
      )
      const studiedCount = studiedSimplifieds.size
      const newCount = Math.max(0, dbWords.length - studiedCount)
      statusCounts['Unstudied'] = newCount

      // Retention comes from the same 365-day dailyStats fetch as the heatmap — no extra reads.
      // Days with no reviews, or written before `correctCount` existed, are omitted rather than
      // plotted at 0%, which also keeps NaN out of the Recharts series.
      const retentionCutoff = new Date()
      retentionCutoff.setDate(retentionCutoff.getDate() - 30)
      const retentionCutoffStr = retentionCutoff.toISOString().slice(0, 10)
      const retention = dailyStats
        .filter((d) => d.date >= retentionCutoffStr && d.totalReviewed > 0 && d.hasCorrectCount)
        .map((d) => ({
          date: d.date,
          rate: Math.round((d.correctCount / d.totalReviewed) * 100),
        }))

      const streak = computeStreak(dailyStats, now)
      const activity = computeActivityTotals(dailyStats, now)
      const hskProgress = computeHskProgress(dbWords, studiedSimplifieds)
      const lastRead: LastReadPosition | null = normalizeLastRead(profile?.lastRead)

      setData({
        dailyCounts: dailyStats,
        statusCounts,
        retention,
        dueCount,
        newCount,
        studiedCount,
        leeches,
        streak,
        activity,
        forecast: computeForecast(allWords, now),
        skillSplit: computeSkillSplit(allWords),
        hskProgress,
        velocity: computeVelocity(dailyStats, now),
        recommendations: recommend({
          now,
          dueCount,
          newAvailable: newCount,
          leechCount: leeches.length,
          weakCount: statusCounts['Weak'] ?? 0,
          studiedCount,
          reviewedToday: activity.reviewedToday,
          currentStreak: streak.current,
          hskProgress,
          lastRead,
        }),
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <div className="p-4 sm:p-8 text-incorrect">{error}</div>
  if (!data) return <div className="p-4 sm:p-8 text-text-muted">Loading…</div>

  const { streak, activity } = data

  return (
    <div className="p-4 sm:p-6 lg:p-8 mx-auto w-full max-w-[1600px] space-y-6 lg:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl sm:text-5xl font-bold text-accent leading-none">{streak.current}</span>
          <span className="text-sm text-text-muted">
            day streak
            {streak.longest > streak.current && <> · best {streak.longest}</>}
          </span>
        </div>
      </header>

      <section aria-labelledby="next-up" className="space-y-3">
        <h2 id="next-up" className="text-sm font-semibold text-text-primary">Next up</h2>
        <NextUpPanel recommendations={data.recommendations} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6 items-start">
        {/* Primary region */}
        <div className="xl:col-span-2 space-y-4 lg:space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
            <StatTile label="Reviewed today" value={activity.reviewedToday.toLocaleString()} tone="accent" />
            <StatTile label="Last 7 days" value={activity.reviewedThisWeek.toLocaleString()} sub={`${activity.newThisWeek} new`} />
            <StatTile
              label="Words studied"
              value={data.studiedCount.toLocaleString()}
              sub={`${data.newCount.toLocaleString()} still unseen`}
            />
            <StatTile
              label="Mastered"
              value={(data.statusCounts['Mastered'] ?? 0).toLocaleString()}
              tone="good"
            />
          </div>

          <DashboardCard title="Study activity" subtitle="Reviews per day over the last year">
            <ActivityHeatmap data={data.dailyCounts} />
          </DashboardCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <DashboardCard title="Retention rate" subtitle="Last 30 days, target 85–90%">
              <RetentionChart data={data.retention} />
            </DashboardCard>
            <DashboardCard title="Upcoming workload" subtitle="Reviews scheduled over the next 14 days">
              <ForecastChart data={data.forecast} />
            </DashboardCard>
          </div>

          <DashboardCard title="New words per week" subtitle="Last 12 weeks">
            <LearningVelocityChart data={data.velocity} />
          </DashboardCard>
        </div>

        {/* Secondary rail — two-up at md/lg so tablet widths do not get a
            column of half-empty cards, single column once it becomes a rail. */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 lg:gap-6 items-start">
          <DueSummary dueCount={data.dueCount} newCount={data.newCount} leechCount={data.leeches.length} />

          <DashboardCard title="Vocabulary progress" subtitle="Words by lifecycle stage">
            <LifecycleChart statusCounts={data.statusCounts} />
          </DashboardCard>

          <DashboardCard title="Accuracy by skill" subtitle="All reviews to date">
            <SkillSplit data={data.skillSplit} />
          </DashboardCard>

          <DashboardCard
            title="HSK progress"
            subtitle="Words studied per level"
            action={<Link to="/hsk" className="text-accent hover:underline">All levels</Link>}
          >
            <HskProgress levels={data.hskProgress} />
          </DashboardCard>
        </div>
      </div>

      <section id="leeches" className="scroll-mt-4">
        <h2 className="text-sm font-semibold text-text-primary mb-3">
          Leeches{data.leeches.length > 0 && ` (${data.leeches.length})`}
        </h2>
        {data.leeches.length > 0 ? (
          <LeechPanel leeches={data.leeches} onUpdate={load} />
        ) : (
          <p className="bg-surface-raised border border-border rounded-2xl px-4 py-6 text-sm text-text-muted text-center">
            No leeches. Nothing is repeatedly failing.
          </p>
        )}
      </section>
    </div>
  )
}
