'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { cn } from '@/lib/utils'
import {
  Home, QrCode, KeyRound, Puzzle, Users, Building2,
  BarChart3, Send, ScrollText, Settings, Bot, Database,
  FolderOpen, Terminal, Moon, Sun, X, ChevronLeft,
  Activity, Package, Bell, Crown, Link2, Server
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: Home, emoji: '🏠' },
  { id: 'qr', label: 'QR Login', icon: QrCode, emoji: '📱' },
  { id: 'pairing', label: 'Pairing', icon: Link2, emoji: '🔗' },
  { id: 'sessions', label: 'Sessions', icon: KeyRound, emoji: '🔐' },
  { id: 'plugins', label: 'Plugins', icon: Puzzle, emoji: '🔌' },
  { id: 'users', label: 'Users', icon: Users, emoji: '👥' },
  { id: 'premium', label: 'Premium', icon: Crown, emoji: '👑' },
  { id: 'groups', label: 'Groups', icon: Building2, emoji: '🏘️' },
  { id: 'stats', label: 'Statistics', icon: BarChart3, emoji: '📊' },
  { id: 'broadcast', label: 'Broadcast', icon: Send, emoji: '📨' },
  { id: 'logs', label: 'Logs', icon: ScrollText, emoji: '📋' },
  { id: 'commands', label: 'Commands', icon: Terminal, emoji: '⌨️' },
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
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full bg-card border-r border-border flex flex-col transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-16',
          'lg:relative lg:z-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 h-16">
          {sidebarOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                CT
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-sm truncate">CALTEX MD</h1>
                <p className="text-[10px] text-muted-foreground truncate">WhatsApp Bot</p>
              </div>
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSidebar}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />}
          </Button>
        </div>

        <Separator />

        {/* Status indicator */}
        {sidebarOpen && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={cn(
                'h-2 w-2 rounded-full',
                botStatus === 'connected' ? 'bg-green-500' : botStatus === 'qr' ? 'bg-yellow-500' : 'bg-red-500'
              )} />
              <span className="text-muted-foreground capitalize">{botStatus}</span>
              {botStatus === 'connected' && <Badge variant="secondary" className="text-[10px] h-4 ml-auto">Online</Badge>}
            </div>
          </div>
        )}

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-2">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActivePanel(item.id); if (window.innerWidth < 1024) toggleSidebar(); }}
                className={cn(
                  'flex items-center gap-3 w-full rounded-md px-3 py-2 text-sm transition-colors',
                  activePanel === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </button>
            ))}
          </nav>
        </ScrollArea>

        <Separator />

        {/* Footer */}
        <div className="p-2">
          <Button
            variant="ghost"
            size={sidebarOpen ? 'sm' : 'icon'}
            className="w-full"
            onClick={toggleDarkMode}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {sidebarOpen && <span className="ml-2 text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </Button>
        </div>
      </aside>
    </>
  )
}
