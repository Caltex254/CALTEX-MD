'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Terminal, Plus, Crown, Clock, Search } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

export function CommandsPanel() {
  const { token } = useDashboardStore()
  const [commands, setCommands] = useState<any[]>([])
  const [customCommands, setCustomCommands] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [newCmd, setNewCmd] = useState({ name: '', trigger: '', response: '', category: '' })
  const [loaded, setLoaded] = useState(false)

  const fetchCommands = async () => {
    try {
      const res = await fetch('/api/commands', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        setCommands(data.data.commands || [])
        setCustomCommands(data.data.customCommands || [])
        setLoaded(true)
      }
    } catch {}
  }

  // Auto-load on first render via subscription pattern
  useSyncExternalStore(
    (onStoreChange) => {
      if (!loaded) fetchCommands().then(onStoreChange)
      return () => {}
    },
    () => loaded,
    () => false
  )

  const toggleCommand = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/commands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isEnabled: !enabled }),
      })
      fetchCommands()
    } catch {}
  }

  const createCustomCommand = async () => {
    if (!newCmd.name || !newCmd.trigger || !newCmd.response) return
    try {
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCmd),
      })
      setNewCmd({ name: '', trigger: '', response: '', category: '' })
      fetchCommands()
    } catch {}
  }

  const filteredCommands = search
    ? commands.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : commands

  const filteredGrouped = filteredCommands.reduce((acc: Record<string, any[]>, cmd) => {
    const cat = cmd.category || 'uncategorized'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(cmd)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-semibold flex items-center gap-2"><Terminal className="h-4 w-4" /> Commands</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-40" />
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Custom</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Custom Command</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={newCmd.name} onChange={(e) => setNewCmd({ ...newCmd, name: e.target.value })} placeholder="hello" /></div>
                <div><Label>Trigger</Label><Input value={newCmd.trigger} onChange={(e) => setNewCmd({ ...newCmd, trigger: e.target.value })} placeholder="^hi$ or hello" /></div>
                <div><Label>Response</Label><Input value={newCmd.response} onChange={(e) => setNewCmd({ ...newCmd, response: e.target.value })} placeholder="Hello there!" /></div>
                <Button onClick={createCustomCommand}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Accordion type="multiple" defaultValue={Object.keys(filteredGrouped)}>
        {Object.entries(filteredGrouped).map(([category, cmds]) => (
          <AccordionItem key={category} value={category}>
            <AccordionTrigger className="capitalize text-sm">{category} ({cmds.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {cmds.map((cmd) => (
                  <div key={cmd.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">!{cmd.name}</span>
                        {cmd.isPremiumOnly && <Badge variant="secondary" className="text-[10px]"><Crown className="h-3 w-3 mr-0.5" />Premium</Badge>}
                        {cmd.cooldown > 0 && <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />{cmd.cooldown}s</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{cmd.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{cmd.usageCount} uses</Badge>
                      <Switch checked={cmd.isEnabled} onCheckedChange={() => toggleCommand(cmd.id, cmd.isEnabled)} />
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {customCommands.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Custom Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customCommands.map((cmd) => (
                <div key={cmd.id} className="flex items-center gap-3 p-2 rounded border">
                  <span className="font-mono text-sm">!{cmd.name}</span>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{cmd.response}</span>
                  <Switch checked={cmd.isEnabled} onCheckedChange={() => toggleCommand(cmd.id, cmd.isEnabled)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
