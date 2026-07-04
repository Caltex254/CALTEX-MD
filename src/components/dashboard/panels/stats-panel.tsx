'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MessageSquare, Terminal, Users, Building2, Zap, AlertTriangle, TrendingUp, Trophy } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

export function StatsPanel() {
  const { token, stats, fetchStats } = useDashboardStore()
  const [statsData, setStatsData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loaded, setLoaded] = useState(false)

  const fetchDetailedStats = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      const res = await fetch(`/api/stats?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setStatsData(data.data)
        setLoaded(true)
      }
    } catch {}
  }

  // Auto-load stats on first render
  useSyncExternalStore(
    (onStoreChange) => {
      if (!loaded) {
        fetchStats()
        fetchDetailedStats().then(onStoreChange)
      }
      return () => {}
    },
    () => loaded,
    () => false
  )

  const summaryCards = [
    { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-green-500' },
    { label: 'Commands', value: stats.totalCommands, icon: Terminal, color: 'text-blue-500' },
    { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-purple-500' },
    { label: 'Groups', value: stats.totalGroups, icon: Building2, color: 'text-orange-500' },
    { label: 'API Calls', value: 0, icon: Zap, color: 'text-cyan-500' },
    { label: 'Errors', value: 0, icon: AlertTriangle, color: 'text-red-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Date Range */}
      <div className="flex items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <Button onClick={() => { fetchStats(); fetchDetailedStats() }}>Apply</Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <s.icon className={`h-6 w-6 mx-auto mb-2 ${s.color}`} />
              <p className="text-xl font-bold">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart Area Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Messages Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm border rounded-md">
              Chart renders with time-series data
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" /> Top Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(statsData?.stats || []).slice(0, 5).map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span>{new Date(s.date).toLocaleDateString()}</span>
                  <span className="text-muted-foreground">{s.commandsExecuted} commands</span>
                </div>
              ))}
              {(!statsData?.stats || statsData.stats.length === 0) && (
                <p className="text-center text-muted-foreground text-sm py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
