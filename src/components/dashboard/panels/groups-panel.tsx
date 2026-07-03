'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, RefreshCw, Shield, Link2, MessageSquareOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function GroupsPanel() {
  const { token } = useDashboardStore()
  const [groups, setGroups] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/groups?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setGroups(data.data.groups || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  const toggleGroupSetting = async (jid: string, field: string, value: boolean) => {
    try {
      await fetch(`/api/groups/${jid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: !value }),
      })
      fetchGroups()
    } catch {}
  }

  const antiFeatures = ['antiLink', 'antiBadword', 'antiSpam', 'antiDelete', 'antiViewOnce']

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold">Groups</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search groups..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" onKeyDown={(e) => e.key === 'Enter' && fetchGroups()} />
          </div>
          <Button variant="ghost" size="icon" onClick={fetchGroups}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>JID</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Anti-Features</TableHead>
                <TableHead>Welcome</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No groups found</TableCell></TableRow>
              ) : groups.map((g) => {
                const activeAnti = antiFeatures.filter((f) => g[f]).length
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name || 'Unnamed'}</TableCell>
                    <TableCell className="font-mono text-xs max-w-32 truncate">{g.jid}</TableCell>
                    <TableCell>{g._count?.members || 0}</TableCell>
                    <TableCell>
                      <Badge variant={activeAnti > 0 ? 'default' : 'secondary'} className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />{activeAnti} active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={g.welcomeEnabled} onCheckedChange={() => toggleGroupSetting(g.jid, 'welcomeEnabled', g.welcomeEnabled)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => toggleGroupSetting(g.jid, 'antiLink', g.antiLink)}>
                        <Link2 className="h-3 w-3 mr-1" />Anti-Link
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
