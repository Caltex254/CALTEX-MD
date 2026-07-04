'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, Bell, Play, Square, RotateCw, LogOut, User } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const panelTitles: Record<string, string> = {
  overview: 'Dashboard',
  qr: 'QR Login',
  sessions: 'Sessions',
  plugins: 'Plugins',
  users: 'Users',
  groups: 'Groups',
  stats: 'Statistics',
  broadcast: 'Broadcast',
  logs: 'Logs',
  commands: 'Commands',
  settings: 'Settings',
  ai: 'AI Configuration',
  backup: 'Backup & Restore',
  files: 'File Manager',
}

export function DashboardHeader() {
  const { activePanel, botStatus, toggleSidebar, logout } = useDashboardStore()

  const handleBotAction = async (action: string) => {
    try {
      const token = useDashboardStore.getState().token
      await fetch(`/api/bot/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      setTimeout(() => useDashboardStore.getState().fetchBotStatus(), 2000)
    } catch {}
  }

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="font-semibold text-lg hidden sm:block">{panelTitles[activePanel] || 'Dashboard'}</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Bot Status */}
        <Badge
          variant={botStatus === 'connected' ? 'default' : botStatus === 'qr' ? 'secondary' : 'destructive'}
          className="text-xs"
        >
          <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${botStatus === 'connected' ? 'bg-green-400' : botStatus === 'qr' ? 'bg-yellow-400' : 'bg-red-400'}`} />
          {botStatus === 'connected' ? 'Connected' : botStatus === 'qr' ? 'QR Ready' : botStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
        </Badge>

        {/* Quick Actions */}
        <div className="hidden md:flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => handleBotAction('start')}>
            <Play className="h-3 w-3 mr-1" /> Start
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBotAction('stop')}>
            <Square className="h-3 w-3 mr-1" /> Stop
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBotAction('restart')}>
            <RotateCw className="h-3 w-3 mr-1" /> Restart
          </Button>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs"><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="text-xs text-muted-foreground">Admin</DropdownMenuItem>
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
