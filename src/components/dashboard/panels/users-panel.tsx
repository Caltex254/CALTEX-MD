'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Crown, Ban, Eye, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function UsersPanel() {
  const { token } = useDashboardStore()
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'premium' | 'banned'>('all')
  const [loading, setLoading] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter === 'premium') params.set('premium', 'true')
      if (filter === 'banned') params.set('banned', 'true')
      const res = await fetch(`/api/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setUsers(data.data.users || [])
    } catch {} finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [filter])

  const togglePremium = async (jid: string, isPremium: boolean) => {
    try {
      await fetch(`/api/users/${jid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isPremium: !isPremium }),
      })
      fetchUsers()
    } catch {}
  }

  const toggleBan = async (jid: string, isBanned: boolean) => {
    try {
      await fetch(`/api/users/${jid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isBanned: !isBanned }),
      })
      fetchUsers()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-semibold">Users</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-48" onKeyDown={(e) => e.key === 'Enter' && fetchUsers()} />
          </div>
          <div className="flex gap-1">
            {(['all', 'premium', 'banned'] as const).map((f) => (
              <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="capitalize">
                {f}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>JID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead>Banned</TableHead>
                <TableHead>Warnings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs max-w-32 truncate">{u.jid}</TableCell>
                  <TableCell>{u.name || u.pushName || '—'}</TableCell>
                  <TableCell>{u.isPremium ? <Badge className="bg-yellow-500/10 text-yellow-600"><Crown className="h-3 w-3 mr-1" />Yes</Badge> : 'No'}</TableCell>
                  <TableCell>{u.isBanned ? <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Yes</Badge> : 'No'}</TableCell>
                  <TableCell>{u.warnings || 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => togglePremium(u.jid, u.isPremium)} title="Toggle Premium">
                        <Crown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleBan(u.jid, u.isBanned)} title="Toggle Ban">
                        <Ban className="h-3 w-3" />
                      </Button>
                    </div>
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
