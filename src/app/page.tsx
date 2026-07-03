'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { OverviewPanel } from '@/components/dashboard/panels/overview-panel'
import { QrPanel } from '@/components/dashboard/panels/qr-panel'
import { SessionsPanel } from '@/components/dashboard/panels/sessions-panel'
import { PluginsPanel } from '@/components/dashboard/panels/plugins-panel'
import { UsersPanel } from '@/components/dashboard/panels/users-panel'
import { GroupsPanel } from '@/components/dashboard/panels/groups-panel'
import { StatsPanel } from '@/components/dashboard/panels/stats-panel'
import { BroadcastPanel } from '@/components/dashboard/panels/broadcast-panel'
import { LogsPanel } from '@/components/dashboard/panels/logs-panel'
import { SettingsPanel } from '@/components/dashboard/panels/settings-panel'
import { AiPanel } from '@/components/dashboard/panels/ai-panel'
import { BackupPanel } from '@/components/dashboard/panels/backup-panel'
import { FilesPanel } from '@/components/dashboard/panels/files-panel'
import { CommandsPanel } from '@/components/dashboard/panels/commands-panel'
import { ServerMonitoringPanel } from '@/components/dashboard/panels/server-monitoring-panel'
import { UpdateManagerPanel } from '@/components/dashboard/panels/update-manager-panel'
import { NotificationCenterPanel } from '@/components/dashboard/panels/notification-center-panel'
import { PremiumManagerPanel } from '@/components/dashboard/panels/premium-manager-panel'
import { PairingPanel } from '@/components/dashboard/panels/pairing-panel'
import { DatabaseManagerPanel } from '@/components/dashboard/panels/database-manager-panel'
import { BugMenuPanel } from '@/components/dashboard/panels/bug-menu-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Loader2 } from 'lucide-react'
import { useState } from 'react'

const panelMap: Record<string, React.ComponentType> = {
  overview: OverviewPanel,
  qr: QrPanel,
  pairing: PairingPanel,
  sessions: SessionsPanel,
  plugins: PluginsPanel,
  users: UsersPanel,
  premium: PremiumManagerPanel,
  groups: GroupsPanel,
  stats: StatsPanel,
  broadcast: BroadcastPanel,
  logs: LogsPanel,
  commands: CommandsPanel,
  bugmenu: BugMenuPanel,
  server: ServerMonitoringPanel,
  updates: UpdateManagerPanel,
  notifications: NotificationCenterPanel,
  database: DatabaseManagerPanel,
  settings: SettingsPanel,
  ai: AiPanel,
  backup: BackupPanel,
  files: FilesPanel,
}

function LoginGate() {
  const { login } = useDashboardStore()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login(username, password)
    if (!ok) setError('Invalid credentials')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-bold text-xl mx-auto mb-3">
            CT
          </div>
          <CardTitle className="text-xl">CALTEX MD</CardTitle>
          <p className="text-sm text-muted-foreground">WhatsApp Bot Dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardLayout() {
  const { activePanel } = useDashboardStore()
  const ActivePanel = panelMap[activePanel] || OverviewPanel

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ActivePanel />
        </main>
      </div>
    </div>
  )
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem('caltex_token') } catch { return null }
}

export default function Home() {
  const { token, setToken } = useDashboardStore()
  const [storedToken] = useState(getStoredToken)

  // Hydrate token from localStorage on first client render
  if (storedToken && !token) {
    // Schedule token set for after render
    queueMicrotask(() => setToken(storedToken))
  }

  // Show loading until we have a token decision
  if (typeof window === 'undefined' || (storedToken && !token)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!token && !storedToken) {
    return <LoginGate />
  }

  return <DashboardLayout />
}
