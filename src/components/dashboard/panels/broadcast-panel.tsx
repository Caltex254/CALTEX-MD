'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, Clock, Paperclip, History } from 'lucide-react'
import { useState, useEffect } from 'react'

export function BroadcastPanel() {
  const { token } = useDashboardStore()
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState('all')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/broadcast', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setHistory(data.data.broadcasts || [])
    } catch {}
  }

  const handleSend = async (schedule = false) => {
    if (!message.trim()) return
    setSending(true)
    try {
      await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message, targetType, scheduledAt: schedule ? scheduledAt : null }),
      })
      setMessage('')
      setScheduledAt('')
      fetchHistory()
    } catch {} finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Compose */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Compose Broadcast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Message</Label>
            <Textarea placeholder="Type your broadcast message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Target</Label>
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users & Groups</SelectItem>
                  <SelectItem value="users">All Users</SelectItem>
                  <SelectItem value="groups">All Groups</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule (optional)</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"><Paperclip className="h-4 w-4 mr-1" /> Attach</Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => handleSend(true)} disabled={sending || !scheduledAt}>
                <Clock className="h-4 w-4 mr-1" /> Schedule
              </Button>
              <Button onClick={() => handleSend(false)} disabled={sending || !message.trim()}>
                <Send className="h-4 w-4 mr-1" /> Send Now
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Broadcast History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">No broadcasts yet</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((b) => (
                <div key={b.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{b.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {b.targetType} • {new Date(b.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={b.status === 'sent' ? 'default' : b.status === 'failed' ? 'destructive' : 'secondary'}>
                    {b.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
