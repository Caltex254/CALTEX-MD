'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skull, Send, AlertTriangle, Shield } from 'lucide-react'

const bugCommands = [
  { id: 'bug1', name: 'Crash Loop', description: 'Poison null bytes + zero-width chars', severity: 'critical' },
  { id: 'bug2', name: 'VCard Injection', description: '300 oversized contact cards', severity: 'critical' },
  { id: 'bug3', name: 'Document Bug', description: 'RLO character filename attack', severity: 'high' },
  { id: 'bug4', name: 'Sticker Bug', description: 'Corrupted webp payload', severity: 'high' },
  { id: 'bug5', name: 'ViewOnce Bug', description: 'Oversized caption on view-once', severity: 'high' },
  { id: 'bug6', name: 'Audio Bug', description: 'Corrupted voice note header', severity: 'high' },
  { id: 'bug7', name: 'Payment Bug', description: 'Corrupted payment amounts', severity: 'medium' },
  { id: 'bug8', name: 'Group Invite Bug', description: 'Corrupted group invite data', severity: 'medium' },
  { id: 'bug9', name: 'Reaction Bomb', description: '50 rapid reactions', severity: 'high' },
  { id: 'bug10', name: 'Contact Array', description: '500 malformed vcards', severity: 'critical' },
  { id: 'bug11', name: 'Location Bug', description: 'Extreme coordinates', severity: 'medium' },
  { id: 'bug12', name: 'Poll Bug', description: '100 oversized poll options', severity: 'medium' },
  { id: 'bug13', name: 'List Bug', description: '100 overflow rows', severity: 'medium' },
  { id: 'bug14', name: 'Button Bug', description: '50 oversized buttons', severity: 'medium' },
  { id: 'bug15', name: 'Newsletter Bug', description: 'Corrupted ad reply metadata', severity: 'medium' },
  { id: 'bug16', name: 'Mention Bomb', description: '300 mentions + zero-width', severity: 'critical' },
  { id: 'bug17', name: 'Forwarded Bug', description: 'Deep forwarding chain (999M)', severity: 'medium' },
  { id: 'bug18', name: 'Caption Bug', description: 'Massive invisible caption', severity: 'high' },
  { id: 'bug19', name: 'Status Bug', description: 'Corrupted broadcast status', severity: 'medium' },
  { id: 'bug20', name: 'Force Stop', description: 'Combo attack (3 phases)', severity: 'critical' },
]

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
}

export function BugMenuPanel() {
  const [target, setTarget] = useState('')
  const [selectedBug, setSelectedBug] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleSendBug = async () => {
    if (!target || !selectedBug) return
    setSending(true)
    setResult(null)

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jid: `${target}@s.whatsapp.net`,
          text: `!${selectedBug} ${target}`,
        }),
      })

      if (response.ok) {
        setResult(`☠️ ${selectedBug.toUpperCase()} sent to ${target}`)
      } else {
        setResult('❌ Failed to send bug command')
      }
    } catch {
      setResult('❌ Network error')
    } finally {
      setSending(false)
      setTimeout(() => setResult(null), 5000)
    }
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="flex items-center gap-3 pt-6">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-400">
            <strong>OWNER ONLY</strong> — Bug commands are restricted to bot owners. Unauthorized use results in an instant ban.
          </p>
        </CardContent>
      </Card>

      {/* Target Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skull className="h-5 w-5" />
            Target Number
          </CardTitle>
          <CardDescription>Enter the target phone number (without + or spaces)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="e.g. 254104906247"
              value={target}
              onChange={(e) => setTarget(e.target.value.replace(/[^0-9]/g, ''))}
              className="flex-1"
            />
            <Badge variant="outline" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {target ? `${target}@s.whatsapp.net` : 'No target'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Bug Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {bugCommands.map((bug) => (
          <Card
            key={bug.id}
            className={`cursor-pointer transition-all hover:scale-[1.02] ${
              selectedBug === bug.id
                ? 'ring-2 ring-red-500 bg-red-500/5'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => setSelectedBug(bug.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm font-bold">{bug.id.toUpperCase()}</span>
                <Badge className={severityColors[bug.severity]} variant="outline">
                  {bug.severity}
                </Badge>
              </div>
              <h4 className="font-semibold text-sm">{bug.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">{bug.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Launch Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSendBug}
              disabled={!target || !selectedBug || sending}
              variant="destructive"
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending
                ? 'Sending...'
                : selectedBug
                  ? `Launch ${selectedBug.toUpperCase()}`
                  : 'Select a bug to launch'}
            </Button>
            {result && (
              <span className={`text-sm ${result.startsWith('☠️') ? 'text-green-400' : 'text-red-400'}`}>
                {result}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
