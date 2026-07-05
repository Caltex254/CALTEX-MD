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
  const [password, setPassword] = useState('')
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: '#060B1A',
        backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(0,229,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(156,77,255,0.06) 0%, transparent 50%)',
      }}
    >
      <Card
        className="w-full max-w-sm animate-fade-in"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(0,229,255,0.1)',
          boxShadow: '0 0 30px rgba(0,229,255,0.05)',
        }}
      >
        <CardHeader className="text-center pb-2">
          <div
            className="w-20 h-20 rounded-full overflow-hidden mx-auto mb-3 animate-logo-pulse"
            style={{
              border: '2px solid rgba(0,229,255,0.3)',
              boxShadow: '0 0 20px rgba(0,229,255,0.2), 0 0 40px rgba(156,77,255,0.1)',
              padding: '2px',
            }}
          >
            <img src="/caltex-profile.png" alt="CALTEX MD" className="w-full h-full object-cover rounded-full" />
          </div>
          <CardTitle
            className="text-xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #00E5FF, #9C4DFF, #FFC107)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            CALTEX MD
          </CardTitle>
          <p className="text-sm text-gray-400">WhatsApp Bot Dashboard</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-black/40 border-white/10 text-white placeholder-gray-500 focus:border-cyan-500/50"
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/40 border-white/10 text-white placeholder-gray-500 focus:border-cyan-500/50"
              />
            </div>
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <Button
              type="submit"
              className="w-full font-medium"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #00E5FF, #9C4DFF)',
                boxShadow: '0 4px 15px rgba(0,229,255,0.3)',
              }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes logo-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.2), 0 0 40px rgba(156,77,255,0.1); }
          50% { box-shadow: 0 0 30px rgba(0,229,255,0.4), 0 0 60px rgba(156,77,255,0.2); }
        }
        .animate-fade-in { animation: fade-in 0.6s ease-out both; }
        .animate-logo-pulse { animation: logo-pulse 3s ease-in-out infinite; }
      `}</style>
    </div>
  )
}

function DashboardLayout() {
  const { activePanel } = useDashboardStore()
  const ActivePanel = panelMap[activePanel] || OverviewPanel

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060B1A' }}>
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
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#060B1A' }}
      >
        <div
          className="w-14 h-14 rounded-full overflow-hidden animate-logo-pulse"
          style={{
            border: '2px solid rgba(0,229,255,0.3)',
            boxShadow: '0 0 20px rgba(0,229,255,0.2)',
            padding: '2px',
          }}
        >
          <img src="/caltex-profile.png" alt="CALTEX MD" className="w-full h-full object-cover rounded-full" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#00E5FF' }} />
        <style jsx global>{`
          @keyframes logo-pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(0,229,255,0.2); }
            50% { box-shadow: 0 0 30px rgba(0,229,255,0.4); }
          }
          .animate-logo-pulse { animation: logo-pulse 2s ease-in-out infinite; }
        `}</style>
      </div>
    )
  }

  if (!token && !storedToken) {
    return <LoginGate />
  }

  return <DashboardLayout />
}
