'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Trash2, ArrowDown, Filter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const LOG_COLORS: Record<string, string> = {
  error: 'text-red-500',
  warn: 'text-yellow-500',
  info: 'text-blue-500',
  debug: 'text-muted-foreground',
}

const LOG_BG: Record<string, string> = {
  error: 'bg-red-500/10',
  warn: 'bg-yellow-500/10',
  info: '',
  debug: '',
}

export function LogsPanel() {
  const { logs, fetchLogs, token } = useDashboardStore()
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchLogs() }, [fetchLogs])

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  const filtered = levelFilter === 'all' ? logs : logs.filter((l) => l.level === levelFilter)

  const clearLogs = async () => {
    try {
      await fetch('/api/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchLogs()
    } catch {}
  }

  const levels = ['all', 'info', 'warn', 'error', 'debug']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {levels.map((l) => (
            <Button
              key={l}
              variant={levelFilter === l ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLevelFilter(l)}
              className="capitalize text-xs"
            >
              {l}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoScroll(!autoScroll)}>
            <ArrowDown className={`h-4 w-4 mr-1 ${autoScroll ? 'text-green-500' : ''}`} />
            Auto-scroll
          </Button>
          <Button variant="outline" size="sm" onClick={clearLogs}>
            <Trash2 className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[600px] overflow-y-auto font-mono text-xs">
            {filtered.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No logs found</div>
            ) : (
              filtered.map((log) => (
                <div key={log.id} className={`flex items-start gap-3 px-4 py-2 border-b border-border/50 ${LOG_BG[log.level] || ''}`}>
                  <Badge variant="outline" className={`text-[10px] h-5 shrink-0 ${LOG_COLORS[log.level] || ''}`}>
                    {log.level.toUpperCase()}
                  </Badge>
                  <span className="text-muted-foreground shrink-0 w-20">{log.source}</span>
                  <span className="flex-1 break-all">{log.message}</span>
                  <span className="text-muted-foreground shrink-0">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
