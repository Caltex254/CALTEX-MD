'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Smartphone, Link2, QrCode, Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export function PairingPanel() {
  const { token, botStatus } = useDashboardStore()
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const generateCode = async () => {
    if (!phone) return
    setLoading(true); setError(''); setPairingCode('')
    try {
      const res = await fetch('/api/pairing-code', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: phone }) })
      const data = await res.json()
      if (data.success && data.data?.pairingCode) setPairingCode(data.data.pairingCode)
      else setError(data.message || 'Failed to generate pairing code')
    } catch { setError('Network error') }
    setLoading(false)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const steps = [
    'Open WhatsApp on your phone',
    'Go to Settings > Linked Devices',
    'Tap "Link a Device"',
    'Enter the pairing code shown below',
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Link2 className="h-5 w-5" />WhatsApp Pairing</h3>
        <Badge variant={botStatus === 'connected' ? 'default' : 'destructive'}>{botStatus === 'connected' ? 'Connected' : 'Disconnected'}</Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" />Generate Pairing Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Phone number with country code (e.g. 628123456789)" value={phone} onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))} className="flex-1" />
            <Button onClick={generateCode} disabled={loading || !phone}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}Generate
            </Button>
          </div>
          {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}
        </CardContent>
      </Card>

      {pairingCode && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">Your Pairing Code</p>
            <p className="text-4xl font-mono font-bold tracking-[0.3em]">{pairingCode}</p>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" /> : <Copy className="h-4 w-4 mr-1" />}{copied ? 'Copied!' : 'Copy Code'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Linking Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">{i + 1}</span>
                <span className="text-sm pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <QrCode className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">QR Alternative</p>
              <p className="text-xs text-muted-foreground">Use QR Login panel instead</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Connection</p>
              <p className="text-xs text-muted-foreground">{botStatus === 'connected' ? 'Bot is online' : 'Bot is offline'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
