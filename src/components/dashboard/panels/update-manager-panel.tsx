'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { PackageCheck, RefreshCw, Download, RotateCcw, History, ArrowUpCircle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

interface UpdateInfo { currentVersion: string; latestVersion: string; updateAvailable: boolean; releaseNotes: string }
interface UpdateHistory { version: string; date: string; status: 'success' | 'failed' }

export function UpdateManagerPanel() {
  const { token } = useDashboardStore()
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [history, setHistory] = useState<UpdateHistory[]>([])
  const [autoUpdate, setAutoUpdate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const headers = { Authorization: `Bearer ${token}` }
    fetch('/api/updates/check', { headers })
      .then(res => res.json())
      .then(data => {
        if (mountedRef.current && data.success) {
          setUpdateInfo({ currentVersion: data.data.currentVersion, latestVersion: data.data.latestVersion, updateAvailable: data.data.updateAvailable, releaseNotes: data.data.releaseNotes || '' })
          setHistory(data.data.history || [])
          setAutoUpdate(data.data.autoUpdate || false)
        }
      })
      .catch(() => { if (mountedRef.current) setUpdateInfo({ currentVersion: '1.0.0', latestVersion: '1.0.0', updateAvailable: false, releaseNotes: '' }) })
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [token, refreshKey])

  const handleUpdate = async () => {
    setUpdating(true)
    await fetch('/api/updates/apply', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setUpdating(false)
    setRefreshKey(k => k + 1)
  }

  const handleRollback = async () => {
    setUpdating(true)
    await fetch('/api/updates/rollback', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setUpdating(false)
    setRefreshKey(k => k + 1)
  }

  const toggleAutoUpdate = async (val: boolean) => {
    setAutoUpdate(val)
    await fetch('/api/updates/auto', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: val }) }).catch(() => {})
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Update Manager</h3>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-muted-foreground" /><span className="text-sm">Current Version</span></div>
            <Badge variant="secondary" className="font-mono">{updateInfo?.currentVersion}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Latest Version</span>
            <Badge variant={updateInfo?.updateAvailable ? 'default' : 'secondary'} className="font-mono">{updateInfo?.latestVersion}</Badge>
          </div>
          {updateInfo?.updateAvailable && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2"><ArrowUpCircle className="h-4 w-4 text-green-500" /><span className="text-sm font-medium">Update Available!</span></div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{updateInfo.releaseNotes || 'No release notes available.'}</p>
            </div>
          )}
          <div className="flex items-center justify-between"><span className="text-sm">Auto-Update</span><Switch checked={autoUpdate} onCheckedChange={toggleAutoUpdate} /></div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-4 w-4 mr-2" />Check for Updates</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="default" disabled={!updateInfo?.updateAvailable || updating} className="flex-1"><Download className="h-4 w-4 mr-2" />{updating ? 'Updating...' : 'Update'}</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Update</AlertDialogTitle><AlertDialogDescription>Update to version {updateInfo?.latestVersion}? The bot will restart.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleUpdate}>Update</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" disabled={updating}><RotateCcw className="h-4 w-4 mr-2" />Rollback</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirm Rollback</AlertDialogTitle><AlertDialogDescription>Rollback to the previous version? The bot will restart.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRollback}>Rollback</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Update History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="max-h-48 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2 border-b last:border-0">
                  <span className="font-mono text-sm">{h.version}</span>
                  <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(h.date).toLocaleDateString()}</span><Badge variant={h.status === 'success' ? 'default' : 'destructive'}>{h.status}</Badge></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
