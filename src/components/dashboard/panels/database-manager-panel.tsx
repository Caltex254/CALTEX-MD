'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Database, Download, Upload, Trash2, Sparkles, RefreshCw, HardDrive, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface DbInfo { type: string; size: number; tables: { name: string; rows: number }[]; health: 'healthy' | 'warning' | 'error' }

const formatSize = (b: number) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`

export function DatabaseManagerPanel() {
  const { token } = useDashboardStore()
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    fetch('/api/database/info', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (mountedRef.current && data.success) setDbInfo(data.data) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [token, refreshKey])

  const runAction = async (action: string, method = 'POST') => {
    setActionLoading(action)
    await fetch(`/api/database/${action}`, { method, headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setActionLoading(null)
    setRefreshKey(k => k + 1)
  }

  const healthBadge = (h: string) => h === 'healthy' ? <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Healthy</Badge>
    : h === 'warning' ? <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Warning</Badge>
    : <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Error</Badge>

  const totalRows = dbInfo?.tables.reduce((a, t) => a + t.rows, 0) || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Database className="h-5 w-5" />Database Manager</h3>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Type</p><p className="text-lg font-bold">{dbInfo?.type || 'SQLite'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Size</p><p className="text-lg font-bold flex items-center gap-1"><HardDrive className="h-4 w-4" />{dbInfo ? formatSize(dbInfo.size) : 'N/A'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tables</p><p className="text-lg font-bold">{dbInfo?.tables.length || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Rows</p><p className="text-lg font-bold">{totalRows.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card><CardContent className="p-4 flex items-center justify-between"><span className="text-sm">Health Status</span>{dbInfo ? healthBadge(dbInfo.health) : <Badge variant="secondary">Unknown</Badge>}</CardContent></Card>

      {dbInfo?.tables && dbInfo.tables.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Table Row Counts</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Table</TableHead><TableHead className="text-right">Rows</TableHead></TableRow></TableHeader>
              <TableBody>
                {dbInfo.tables.map(t => (
                  <TableRow key={t.name}><TableCell className="font-mono text-sm">{t.name}</TableCell><TableCell className="text-right">{t.rows.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => runAction('backup')} disabled={actionLoading === 'backup'}>
          <Download className="h-4 w-4 mr-2" />{actionLoading === 'backup' ? 'Backing up...' : 'Backup'}
        </Button>
        <Button variant="outline" onClick={() => runAction('restore')} disabled={actionLoading === 'restore'}>
          <Upload className="h-4 w-4 mr-2" />{actionLoading === 'restore' ? 'Restoring...' : 'Restore'}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={actionLoading === 'clear-logs'}><Trash2 className="h-4 w-4 mr-2" />Clear Old Logs</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Clear Old Logs</AlertDialogTitle><AlertDialogDescription>This will permanently delete logs older than 30 days. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => runAction('clear-logs')}>Clear</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={actionLoading === 'vacuum'}><Sparkles className="h-4 w-4 mr-2" />Vacuum</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Vacuum Database</AlertDialogTitle><AlertDialogDescription>Optimize the database and reclaim disk space. The bot may be briefly unavailable.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => runAction('vacuum')}>Vacuum</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
