'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Download, Upload, Trash2, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export function SessionsPanel() {
  const { sessions, fetchSessions } = useDashboardStore()

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      connected: 'default', disconnected: 'destructive', qr: 'secondary',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  const handleDelete = async (id: string) => {
    try {
      const token = useDashboardStore.getState().token
      await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchSessions()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Sessions</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Import</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
          <Button variant="ghost" size="sm" onClick={() => fetchSessions()}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Session ID</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No sessions found
                  </TableCell>
                </TableRow>
              ) : sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id.slice(0, 8)}...</TableCell>
                  <TableCell className="font-mono text-xs">{s.sessionId}</TableCell>
                  <TableCell>{s.phoneNumber || '—'}</TableCell>
                  <TableCell>{statusBadge(s.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
