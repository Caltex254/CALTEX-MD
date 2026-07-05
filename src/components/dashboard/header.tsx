'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Menu, Bell, Play, Square, RotateCw, LogOut, User, Wifi } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const panelTitles: Record<string, string> = {
  overview: 'Dashboard',
  pairing: 'Pair Device',
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
    <header
      className="h-16 flex items-center justify-between px-4 gap-4"
      style={{
        background: 'rgba(6,11,26,0.9)',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden text-gray-400 hover:text-white hover:bg-white/5" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <h2
          className="font-semibold text-lg hidden sm:block"
          style={{
            background: 'linear-gradient(135deg, #00E5FF, #9C4DFF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {panelTitles[activePanel] || 'Dashboard'}
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Bot Status */}
        {botStatus === 'connected' ? (
          <span
            className="text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{
              color: '#25D366',
              background: 'rgba(37,211,102,0.1)',
              border: '1px solid rgba(37,211,102,0.2)',
              boxShadow: '0 0 10px rgba(37,211,102,0.1)',
            }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#25D366' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#25D366' }} />
            </span>
            <Wifi className="w-3 h-3" />
            Connected
          </span>
        ) : botStatus === 'qr' ? (
          <Badge
            className="text-xs"
            style={{
              background: 'rgba(255,193,7,0.1)',
              color: '#FFC107',
              border: '1px solid rgba(255,193,7,0.2)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: '#FFC107' }} />
            QR Ready
          </Badge>
        ) : (
          <Badge
            variant="destructive"
            className="text-xs"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full mr-1.5" style={{ backgroundColor: '#ef4444' }} />
            {botStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
          </Badge>
        )}

        {/* Quick Actions */}
        <div className="hidden md:flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBotAction('start')}
            className="text-xs border-white/10 hover:bg-white/5 hover:border-cyan-500/30 text-gray-300"
          >
            <Play className="h-3 w-3 mr-1" style={{ color: '#25D366' }} /> Start
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBotAction('stop')}
            className="text-xs border-white/10 hover:bg-white/5 hover:border-red-500/30 text-gray-300"
          >
            <Square className="h-3 w-3 mr-1" style={{ color: '#ef4444' }} /> Stop
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBotAction('restart')}
            className="text-xs border-white/10 hover:bg-white/5 hover:border-purple-500/30 text-gray-300"
          >
            <RotateCw className="h-3 w-3 mr-1" style={{ color: '#9C4DFF' }} /> Restart
          </Button>
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-white hover:bg-white/5">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-white/5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs" style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF' }}>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={{
              background: 'rgba(6,11,26,0.95)',
              border: '1px solid rgba(0,229,255,0.1)',
              boxShadow: '0 0 20px rgba(0,229,255,0.1)',
            }}
          >
            <DropdownMenuItem className="text-xs text-gray-400 focus:bg-white/5">Admin</DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-gray-300 focus:bg-white/5">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
