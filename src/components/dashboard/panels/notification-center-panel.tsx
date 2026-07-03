'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Bell, BellOff, Trash2, CheckCheck, Filter, AlertTriangle, Info, AlertOctagon } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

type Severity = 'info' | 'warn' | 'error' | 'critical'
type NotifType = 'disconnect' | 'session' | 'plugin' | 'db' | 'api' | 'update'

interface Notification {
  id: string; title: string; message: string; severity: Severity; type: NotifType; read: boolean; timestamp: string
}

const severityColor: Record<Severity, string> = {
  info: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  warn: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  error: 'bg-red-500/15 text-red-600 border-red-500/30',
  critical: 'bg-red-600/20 text-red-700 border-red-600/40',
}
const severityIcon: Record<Severity, React.ElementType> = { info: Info, warn: AlertTriangle, error: AlertOctagon, critical: AlertOctagon }

export function NotificationCenterPanel() {
  const { token } = useDashboardStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (mountedRef.current && data.success) setNotifications(data.data.notifications || []) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [token])

  const unreadCount = notifications.filter(n => !n.read).length
  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter)

  const markRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    fetch(`/api/notifications/${id}/read`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    fetch('/api/notifications/read-all', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }

  const deleteNotif = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}><CheckCheck className="h-4 w-4" /></Button>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger size="sm" className="w-36"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="disconnect">Disconnect</SelectItem>
              <SelectItem value="session">Session</SelectItem>
              <SelectItem value="plugin">Plugin</SelectItem>
              <SelectItem value="db">Database</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="update">Update</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center"><BellOff className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">No notifications</p></div>
            ) : filtered.map(n => {
              const Icon = severityIcon[n.severity]
              return (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 hover:bg-accent/50 transition-colors ${!n.read ? 'bg-accent/20' : ''}`}>
                  <div className={`mt-0.5 p-1.5 rounded-md border ${severityColor[n.severity]} ${n.severity === 'critical' ? 'animate-pulse' : ''}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      <Badge variant="outline" className="text-[10px] h-4">{n.type}</Badge>
                      {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.timestamp).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!n.read && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markRead(n.id)}><Bell className="h-3.5 w-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteNotif(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )
            })}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
