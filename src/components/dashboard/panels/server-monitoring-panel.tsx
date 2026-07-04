'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Cpu, MemoryStick, HardDrive, Wifi, Clock, Code, Monitor, RefreshCw } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface SystemInfo {
  cpu: { model: string; cores: number; speed: number; loadAvg: { '1m': number; '5m': number; '15m': number } }
  memory: { total: number; used: number; free: number; usagePercent: number; heapUsed: number; heapTotal: number; rss: number }
  disk: { note?: string; used?: number; total?: number }
  uptime: { seconds: number; formatted: string }
  os: { platform: string; arch: string; hostname: string; release: string }
  runtime: { nodeVersion: string; pid: number }
}

const usageColor = (v: number) => v >= 85 ? 'text-red-500' : v >= 60 ? 'text-yellow-500' : 'text-green-500'
const usageProgressClass = (v: number) => v >= 85 ? '[&>div]:bg-red-500' : v >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
const formatBytes = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(1)} GB` : `${(b / 1048576).toFixed(0)} MB`

export function ServerMonitoringPanel() {
  const { token, botStatus } = useDashboardStore()
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const headers = { Authorization: `Bearer ${token}` }
    fetch('/api/system', { headers })
      .then(res => res.json())
      .then(data => { if (mountedRef.current && data.success) setInfo(data.data) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })

    const iv = setInterval(() => {
      fetch('/api/system', { headers })
        .then(res => res.json())
        .then(data => { if (mountedRef.current && data.success) setInfo(data.data) })
        .catch(() => {})
    }, 10000)

    return () => { mountedRef.current = false; clearInterval(iv) }
  }, [token, refreshKey])

  // CPU load as percentage (load average * 100 / cores, capped at 100)
  const cpuPercent = info ? Math.min(Math.round((info.cpu.loadAvg['1m'] / info.cpu.cores) * 100), 100) : 0
  const ramPercent = info ? info.memory.usagePercent : 0

  const bars: { label: string; value: number; icon: React.ElementType; detail: string }[] = info ? [
    { label: 'CPU', value: cpuPercent, icon: Cpu, detail: info.cpu.model || `${cpuPercent}%` },
    { label: 'RAM', value: ramPercent, icon: MemoryStick, detail: `${formatBytes(info.memory.used)} / ${formatBytes(info.memory.total)}` },
    { label: 'Heap', value: Math.round((info.memory.heapUsed / info.memory.heapTotal) * 100), icon: HardDrive, detail: `${formatBytes(info.memory.heapUsed)} / ${formatBytes(info.memory.heapTotal)}` },
  ] : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Server Monitoring</h3>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {bars.map(b => (
            <Card key={b.label}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><b.icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{b.label}</span></div>
                  <span className={`text-sm font-bold ${usageColor(b.value)}`}>{b.value}%</span>
                </div>
                <Progress value={b.value} className={`h-2 ${usageProgressClass(b.value)}`} />
                <p className="text-xs text-muted-foreground truncate">{b.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><Wifi className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Load (1m)</p><p className="text-sm font-medium">{info ? info.cpu.loadAvg['1m'].toFixed(2) : 'N/A'}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Clock className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Uptime</p><p className="text-sm font-medium">{info ? info.uptime.formatted : 'N/A'}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Code className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Node.js</p><p className="text-sm font-medium">{info?.runtime.nodeVersion || 'N/A'}</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><Monitor className="h-5 w-5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">OS</p><p className="text-sm font-medium truncate">{info ? `${info.os.platform} ${info.os.arch}` : 'N/A'}</p></div></CardContent></Card>
      </div>

      <Card><CardContent className="p-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">Bot Status</span><Badge variant={botStatus === 'connected' ? 'default' : 'destructive'}>{botStatus}</Badge></CardContent></Card>
    </div>
  )
}
