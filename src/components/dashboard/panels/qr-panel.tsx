'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { QrCode, RefreshCw, Smartphone, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

export function QrPanel() {
  const { botStatus, qrCode, fetchBotStatus } = useDashboardStore()
  const [sessionId, setSessionId] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const refreshQr = async () => {
    setRefreshing(true)
    try {
      const token = useDashboardStore.getState().token
      await fetch('/api/bot/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      })
      await fetchBotStatus()
    } catch {} finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchBotStatus()
    const interval = setInterval(refreshQr, 30000)
    return () => clearInterval(interval)
  }, [fetchBotStatus])

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Connection Status */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          {botStatus === 'connected' ? (
            <Wifi className="h-8 w-8 text-green-500" />
          ) : botStatus === 'qr' ? (
            <QrCode className="h-8 w-8 text-yellow-500" />
          ) : (
            <WifiOff className="h-8 w-8 text-red-500" />
          )}
          <div>
            <p className="font-medium">
              {botStatus === 'connected' ? 'Bot Connected' : botStatus === 'qr' ? 'Scan QR Code' : 'Disconnected'}
            </p>
            <p className="text-sm text-muted-foreground">
              {botStatus === 'connected'
                ? 'Your bot is active and running'
                : botStatus === 'qr'
                ? 'Open WhatsApp and scan the QR code'
                : 'Start the bot to generate a QR code'}
            </p>
          </div>
          <Badge variant={botStatus === 'connected' ? 'default' : botStatus === 'qr' ? 'secondary' : 'destructive'} className="ml-auto">
            {botStatus}
          </Badge>
        </CardContent>
      </Card>

      {/* QR Code Display */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> WhatsApp QR Code
            </CardTitle>
            <Button variant="outline" size="sm" onClick={refreshQr} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pb-6">
          <div className="w-64 h-64 border-2 border-dashed border-border rounded-xl flex items-center justify-center bg-muted/30">
            {qrCode ? (
              <img src={qrCode} alt="QR Code" className="w-full h-full p-2" />
            ) : botStatus === 'connected' ? (
              <div className="text-center text-green-500">
                <Wifi className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Already Connected</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">Click Refresh to generate QR</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Open WhatsApp → Linked Devices → Link a Device → Scan this QR code
          </p>
        </CardContent>
      </Card>

      {/* Session Pairing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pair with Session ID</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter session ID"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            />
            <Button disabled={!sessionId}>Pair</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
