'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Search, RefreshCw, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PluginsPanel() {
  const { plugins, fetchPlugins } = useDashboardStore()
  const [search, setSearch] = useState('')

  useEffect(() => { fetchPlugins() }, [fetchPlugins])

  const filtered = plugins.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const togglePlugin = async (id: string, enabled: boolean) => {
    try {
      const token = useDashboardStore.getState().token
      await fetch(`/api/plugins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isEnabled: !enabled }),
      })
      fetchPlugins()
    } catch {}
  }

  const reloadPlugin = async (id: string) => {
    try {
      const token = useDashboardStore.getState().token
      await fetch(`/api/plugins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reload: true }),
      })
      fetchPlugins()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Plugins</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search plugins..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => fetchPlugins()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No plugins found</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{p.name}</CardTitle>
                  <Switch checked={p.enabled} onCheckedChange={() => togglePlugin(p.id, p.enabled)} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">{p.description || 'No description'}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => reloadPlugin(p.id)}>
                    <RotateCw className="h-3 w-3 mr-1" /> Reload
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
