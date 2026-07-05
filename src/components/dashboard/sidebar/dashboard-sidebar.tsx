'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { cn } from '@/lib/utils'
import {
  Home, QrCode, KeyRound, Puzzle, Users, Building2,
  BarChart3, Send, ScrollText, Settings, Bot, Database,
  FolderOpen, Terminal, Moon, Sun, X, ChevronLeft,
  Activity, Package, Bell, Crown, Link2, Server, Skull
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: Home, emoji: '🏠' },
  { id: 'pairing', label: 'Pair Device', icon: Link2, emoji: '🔗' },
  { id: 'qr', label: 'QR Login', icon: QrCode, emoji: '📱' },
  { id: 'sessions', label: 'Sessions', icon: KeyRound, emoji: '🔐' },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, emoji: '🔌' },
  { id: 'users', label: 'Users', icon: Users, emoji: '👥' },
  { id: 'premium', label: 'Premium', icon: Crown, emoji: '👑' },
  { id: 'groups', label: 'Groups', icon: Building2, emoji: '🏘️' },
  { id: 'stats', label: 'Statistics', icon: BarChart3, emoji: '📊' },
  { id: 'broadcast', label: 'Broadcast', icon: Send, emoji: '📨' },
  { id: 'logs', label: 'Logs', icon: ScrollText, emoji: '📋' },
  { id: 'commands', label: 'Commands', icon: Terminal, emoji: '⌨️' },
  { id: 'bugmenu', label: 'Bug Menu', icon: Skull, emoji: '☠️' },
  { id: 'server', label: 'Server', icon: Server, emoji: '🖥️' },
  { id: 'updates', label: 'Updates', icon: Package, emoji: '📦' },
  { id: 'notifications', label: 'Notifications', icon: Bell, emoji: '🔔' },
  { id: 'database', label: 'Database', icon: Database, emoji: '🗄️' },
  { id: 'settings', label: 'Settings', icon: Settings, emoji: '⚙️' },
  { id: 'ai', label: 'AI Config', icon: Bot, emoji: '🤖' },
  { id: 'backup', label: 'Backup', icon: Database, emoji: '💾' },
  { id: 'files', label: 'Files', icon: FolderOpen, emoji: '📁' },
]

export function DashboardSidebar() {
  const { sidebarOpen, activePanel, botStatus, darkMode, toggleSidebar, setActivePanel, toggleDarkMode } = useDashboardStore()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-16',
          'lg:relative lg:z-0'
        )}
        style={{
          background: 'rgba(6,11,26,0.95)',
          borderRight: '1px solid rgba(0,229,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 h-16">
          {sidebarOpen ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-full overflow-hidden shrink-0"
                style={{
                  border: '2px solid rgba(0,229,255,0.3)',
                  boxShadow: '0 0 10px rgba(0,229,255,0.15)',
                  padding: '1px',
                }}
              >
                <img src="/caltex-profile.png" alt="CALTEX MD" className="w-full h-full object-cover rounded-full" />
              </div>
              <div className="min-w-0">
                <h1
                  className="font-bold text-sm truncate"
                  style={{
                    background: 'linear-gradient(135deg, #00E5FF, #9C4DFF)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  CALTEX MD
                </h1>
                <p className="text-[10px] text-gray-500 truncate">WhatsApp Bot</p>
              </div>
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-full overflow-hidden mx-auto"
              style={{
                border: '1.5px solid rgba(0,229,255,0.3)',
                boxShadow: '0 0 8px rgba(0,229,255,0.15)',
                padding: '1px',
              }}
            >
              <img src="/caltex-profile.png" alt="CALTEX MD" className="w-full h-full object-cover rounded-full" />
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gray-400 hover:text-white hover:bg-white/5" onClick={toggleSidebar}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />}
          </Button>
        </div>

        <Separator style={{ backgroundColor: 'rgba(0,229,255,0.08)' }} />

        {/* Status indicator */}
        {sidebarOpen && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="relative flex h-2 w-2">
                {botStatus === 'connected' && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#25D366' }} />
                )}
                <span
                  className={cn('relative inline-flex rounded-full h-2 w-2')}
                  style={{
                    backgroundColor: botStatus === 'connected' ? '#25D366' : botStatus === 'qr' ? '#FFC107' : '#ef4444',
                  }}
                />
              </span>
              <span className="text-gray-400 capitalize">{botStatus}</span>
              {botStatus === 'connected' && (
                <Badge
                  className="text-[10px] h-4 ml-auto"
                  style={{
                    background: 'rgba(37,211,102,0.15)',
                    color: '#25D366',
                    border: '1px solid rgba(37,211,102,0.2)',
                  }}
                >
                  Online
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActivePanel(item.id); if (window.innerWidth < 1024) toggleSidebar(); }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm transition-all duration-200',
                  !sidebarOpen && 'justify-center px-2'
                )}
                style={{
                  background: activePanel === item.id
                    ? 'linear-gradient(135deg, rgba(0,229,255,0.15), rgba(156,77,255,0.1))'
                    : 'transparent',
                  color: activePanel === item.id ? '#00E5FF' : '#9ca3af',
                  borderLeft: activePanel === item.id ? '2px solid #00E5FF' : '2px solid transparent',
                  boxShadow: activePanel === item.id ? '0 0 10px rgba(0,229,255,0.1)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (activePanel !== item.id) {
                    e.currentTarget.style.background = 'rgba(0,229,255,0.05)'
                    e.currentTarget.style.color = '#e5e7eb'
                  }
                }}
                onMouseLeave={(e) => {
                  if (activePanel !== item.id) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = '#9ca3af'
                  }
                }}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <Separator style={{ backgroundColor: 'rgba(0,229,255,0.08)' }} />

        {/* Footer */}
        <div className="p-2">
          <Button
            variant="ghost"
            size={sidebarOpen ? 'sm' : 'icon'}
            className="w-full text-gray-400 hover:text-white hover:bg-white/5"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="h-4 w-4" style={{ color: '#FFC107' }} /> : <Moon className="h-4 w-4" />}
            {sidebarOpen && <span className="ml-2 text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </Button>
        </div>
      </aside>
    </>
  )
}
