'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Database, Plus, RotateCcw, Trash2, Download, HardDrive } from 'lucide-react'
import { useEffect, useState } from 'react'

export function BackupPanel() {
  const { token } = useDashboardStore()
  const [backups, setBackups] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [autoBackup, setAutoBackup] = useState(false)

  useEffect(() => { fetchBackups() }, [])

  const fetchBackups = async () => {
    try {
      const res = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setBackups(data.data.backups || [])
    } catch {}
  }

  const createBackup = async () => {
    setCreating(true)
    try {
      await fetch('/api/backup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchBackups()
    } catch {} finally {
      setCreating(false)
    }
  }

  const restoreBackup = async (filename: string) => {
    if (!confirm(`Restore from ${filename}? This will overwrite current settings.`)) return
    try {
      await fetch('/api/backup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename }),
      })
      alert('Backup restored successfully')
    } catch {}
  }

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup ${filename}?`)) return
    try {
      await fetch('/api/backup', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename }),
      })
      fetchBackups()
    } catch {}
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Auto Backup Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4" /> Auto Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Auto Backup</Label>
              <p className="text-xs text-muted-foreground">Automatically create backups daily</p>
            </div>
            <Switch checked={autoBackup} onCheckedChange={setAutoBackup} />
          </div>
        </CardContent>
      </Card>

      {/* Create Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" /> Create Backup</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Backup includes: sessions, settings, database, plugins</p>
          <Button onClick={createBackup} disabled={creating}>
            <Plus className="h-4 w-4 mr-1" /> {creating ? 'Creating...' : 'Create Backup Now'}
          </Button>
        </CardContent>
      </Card>

      {/* Available Backups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Available Backups</CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">No backups available</p>
          ) : (
            <div className="space-y-3">
              {backups.map((b, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <Database className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{b.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatSize(b.size)} • {b.createdAt ? new Date(b.createdAt).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => restoreBackup(b.filename)}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Restore
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteBackup(b.filename)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
