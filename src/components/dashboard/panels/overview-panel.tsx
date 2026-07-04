'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MessageSquare, Terminal, Users, Building2, Wifi, WifiOff, RefreshCw, Activity } from 'lucide-react'
import { useEffect } from 'react'

export function OverviewPanel() {
  const { stats, botStatus, connectedDevices, fetchBotStatus, fetchStats, setActivePanel } = useDashboardStore()

  useEffect(() => {
    fetchBotStatus()
    fetchStats()
    const interval = setInterval(() => { fetchBotStatus(); fetchStats() }, 30000)
    return () => clearInterval(interval)
  }, [fetchBotStatus, fetchStats])

  const statCards = [
    { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-green-500' },
    { label: 'Commands', value: stats.totalCommands, icon: Terminal, color: 'text-blue-500' },
    { label: 'Users', value: stats.totalUsers, icon: Users, color: 'text-purple-500' },
    { label: 'Groups', value: stats.totalGroups, icon: Building2, color: 'text-orange-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                </div>
                <s.icon className={`h-8 w-8 ${s.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bot Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Bot Status</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { fetchBotStatus(); fetchStats() }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {botStatus === 'connected' ? (
              <Wifi className="h-10 w-10 text-green-500" />
            ) : (
              <WifiOff className="h-10 w-10 text-red-500" />
            )}
            <div>
              <p className="font-medium capitalize">{botStatus}</p>
              <p className="text-sm text-muted-foreground">
                {connectedDevices} device(s) connected
              </p>
            </div>
            <Badge variant={botStatus === 'connected' ? 'default' : 'destructive'} className="ml-auto">
              {botStatus === 'connected' ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'QR Login', panel: 'qr' },
              { label: 'Sessions', panel: 'sessions' },
              { label: 'Plugins', panel: 'plugins' },
              { label: 'Settings', panel: 'settings' },
            ].map((a) => (
              <Button key={a.panel} variant="outline" onClick={() => setActivePanel(a.panel)}>
                {a.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Placeholder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
            Activity chart will appear when data is available
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
