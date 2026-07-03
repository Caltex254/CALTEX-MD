'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Crown, Plus, Trash2, Search, RefreshCw, Users, AlertCircle } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

type Plan = 'basic' | 'pro' | 'elite'
interface PremiumUser { id: string; jid: string; plan: Plan; expiresAt: string; status: 'active' | 'expired' }

const planBadge: Record<Plan, string> = { basic: 'secondary', pro: 'default', elite: 'destructive' }

export function PremiumManagerPanel() {
  const { token } = useDashboardStore()
  const [users, setUsers] = useState<PremiumUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ jid: '', plan: 'basic' as Plan, duration: '30' })
  const [refreshKey, setRefreshKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    fetch('/api/premium', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => { if (mountedRef.current && data.success) setUsers(data.data.users || []) })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false) })
    return () => { mountedRef.current = false }
  }, [token, refreshKey])

  const addPremium = async () => {
    await fetch('/api/premium', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jid: form.jid, plan: form.plan, durationDays: parseInt(form.duration) }) }).catch(() => {})
    setForm({ jid: '', plan: 'basic', duration: '30' })
    setRefreshKey(k => k + 1)
  }

  const removePremium = async (id: string) => {
    await fetch(`/api/premium/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setRefreshKey(k => k + 1)
  }

  const filtered = users.filter(u => u.jid.toLowerCase().includes(search.toLowerCase()))
  const activeCount = users.filter(u => u.status === 'active').length
  const expiringSoon = users.filter(u => u.status === 'active' && new Date(u.expiresAt).getTime() - Date.now() < 7 * 86400000).length
  const byPlan = (p: Plan) => users.filter(u => u.plan === p && u.status === 'active').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Crown className="h-5 w-5 text-yellow-500" />Premium Manager</h3>
        <Button variant="ghost" size="sm" onClick={() => setRefreshKey(k => k + 1)}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Premium</p><p className="text-2xl font-bold">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Basic</p><p className="text-2xl font-bold">{byPlan('basic')}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pro</p><p className="text-2xl font-bold">{byPlan('pro')}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Expiring Soon</p><p className="text-2xl font-bold flex items-center gap-1">{expiringSoon}{expiringSoon > 0 && <AlertCircle className="h-4 w-4 text-yellow-500" />}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" />Add Premium User</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="JID (e.g. 628123456789@s.whatsapp.net)" value={form.jid} onChange={e => setForm(f => ({ ...f, jid: e.target.value }))} className="flex-1" />
            <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v as Plan }))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="basic">Basic</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="elite">Elite</SelectItem></SelectContent>
            </Select>
            <Select value={form.duration} onValueChange={v => setForm(f => ({ ...f, duration: v }))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">7 Days</SelectItem><SelectItem value="30">30 Days</SelectItem><SelectItem value="90">90 Days</SelectItem><SelectItem value="365">1 Year</SelectItem></SelectContent>
            </Select>
            <Button onClick={addPremium} disabled={!form.jid}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <div className="relative flex-1"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search by JID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>JID</TableHead><TableHead>Plan</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Users className="h-6 w-6 mx-auto mb-1" />No premium users</TableCell></TableRow>
                : filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.jid}</TableCell>
                    <TableCell><Badge variant={planBadge[u.plan] as any}>{u.plan}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(u.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell><Badge variant={u.status === 'active' ? 'default' : 'destructive'}>{u.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove Premium</AlertDialogTitle><AlertDialogDescription>Remove premium for {u.jid}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removePremium(u.id)}>Remove</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
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
