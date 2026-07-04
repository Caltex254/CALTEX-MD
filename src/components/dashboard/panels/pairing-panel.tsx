'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Smartphone, Link2, QrCode, Loader2, CheckCircle2, AlertCircle, Copy, RefreshCw, Phone, Shield, Zap, ArrowRight, Wifi } from 'lucide-react'
import { useState, useEffect } from 'react'

export function PairingPanel() {
  const { token, botStatus, fetchBotStatus } = useDashboardStore()
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPairingDialog, setShowPairingDialog] = useState(false)
  const [step, setStep] = useState<'input' | 'generating' | 'code' | 'waiting' | 'connected'>('input')
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    fetchBotStatus()
  }, [fetchBotStatus])

  // Countdown timer for pairing code expiry
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // Auto-check connection status while waiting for pairing
  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(async () => {
      await fetchBotStatus()
      if (botStatus === 'connected') {
        setStep('connected')
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [step, botStatus, fetchBotStatus])

  const generateCode = async () => {
    if (!phone) return
    setLoading(true)
    setError('')
    setPairingCode('')
    setStep('generating')
    setShowPairingDialog(true)

    try {
      const res = await fetch('/api/pairing-code', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      const data = await res.json()
      if (data.success && data.data?.pairingCode) {
        setPairingCode(data.data.pairingCode)
        setStep('code')
        setCountdown(120) // 2 min expiry
      } else {
        setError(data.message || data.error || 'Failed to generate pairing code')
        setStep('input')
        setShowPairingDialog(false)
      }
    } catch {
      setError('Network error — make sure the bot service is running')
      setStep('input')
      setShowPairingDialog(false)
    }
    setLoading(false)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProceed = () => {
    setStep('waiting')
  }

  const handleReset = () => {
    setShowPairingDialog(false)
    setPairingCode('')
    setStep('input')
    setError('')
    setCountdown(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Pair Device (Method 1)
        </h3>
        <Badge variant={botStatus === 'connected' ? 'default' : 'destructive'}>
          {botStatus === 'connected' ? 'Connected' : 'Disconnected'}
        </Badge>
      </div>

      {/* Method 1 — Recommended */}
      <Card className="border-2 border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" /> Method 1: Phone + Pairing Code
            </CardTitle>
            <Badge className="bg-green-600 text-white">Recommended</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter your phone number to receive a pairing code. Then enter the code in WhatsApp to link your device — no QR scan needed!
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+</span>
              <Input
                placeholder="Phone number with country code (e.g. 254104906247)"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="pl-7"
              />
            </div>
            <Button onClick={generateCode} disabled={loading || !phone || phone.length < 10} className="bg-green-600 hover:bg-green-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
              Get Pairing Code
            </Button>
          </div>
          {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-4 w-4" />{error}</p>}

          {/* Quick steps preview */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 text-center">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
              <span className="text-xs font-medium">Enter Phone</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 text-center">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
              <span className="text-xs font-medium">Get Pairing Code</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 text-center">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
              <span className="text-xs font-medium">Enter in WhatsApp</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pairing Code Dialog (Popup) */}
      <Dialog open={showPairingDialog} onOpenChange={(open) => { if (!open) handleReset() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === 'generating' && <Loader2 className="h-5 w-5 animate-spin" />}
              {step === 'code' && <Shield className="h-5 w-5 text-green-500" />}
              {step === 'waiting' && <Smartphone className="h-5 w-5 text-blue-500" />}
              {step === 'connected' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {step === 'generating' && 'Generating Pairing Code...'}
              {step === 'code' && 'Your Pairing Code'}
              {step === 'waiting' && 'Waiting for WhatsApp Link...'}
              {step === 'connected' && 'Device Paired Successfully!'}
            </DialogTitle>
            <DialogDescription>
              {step === 'generating' && 'Requesting pairing code from WhatsApp...'}
              {step === 'code' && 'Enter this code in WhatsApp to link your device.'}
              {step === 'waiting' && 'Enter the code in WhatsApp now. We\'re waiting for the link...'}
              {step === 'connected' && 'Your WhatsApp has been linked successfully!'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Generating state */}
            {step === 'generating' && (
              <div className="flex flex-col items-center py-8 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Sending pairing request for +{phone}...</p>
              </div>
            )}

            {/* Code display */}
            {step === 'code' && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-primary/10 rounded-xl p-6 w-full text-center space-y-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pairing Code</p>
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-primary">{pairingCode}</p>
                  {countdown > 0 && (
                    <p className="text-xs text-muted-foreground">Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={copyCode} className="gap-2">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>

                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-4 w-full space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2"><Smartphone className="h-4 w-4" /> Follow these steps:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">1</span>
                      Open WhatsApp on your phone
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">2</span>
                      Go to <b>Settings &gt; Linked Devices</b>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">3</span>
                      Tap <b>&quot;Link a Device&quot;</b>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">4</span>
                      Tap <b>&quot;Link with phone number&quot;</b> instead of scanning
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">5</span>
                      Enter the pairing code shown above: <b className="text-primary">{pairingCode}</b>
                    </li>
                  </ol>
                </div>

                <Button onClick={handleProceed} className="w-full gap-2">
                  I've entered the code — Continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Waiting for connection */}
            {step === 'waiting' && (
              <div className="flex flex-col items-center py-6 gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                  <Wifi className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Waiting for WhatsApp to confirm the link...<br />
                  Make sure you entered the code <b className="text-primary">{pairingCode}</b> on your phone.
                </p>
                {botStatus === 'connected' && (
                  <div className="flex items-center gap-2 text-green-500 font-medium">
                    <CheckCircle2 className="h-5 w-5" /> Connected!
                  </div>
                )}
              </div>
            )}

            {/* Connected state */}
            {step === 'connected' && (
              <div className="flex flex-col items-center py-6 gap-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <div className="text-center">
                  <p className="font-semibold text-lg">Device Paired Successfully!</p>
                  <p className="text-sm text-muted-foreground mt-1">Your WhatsApp is now linked to CALTEX MD bot.</p>
                </div>
                <Button onClick={handleReset} className="gap-2">Close</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Method 2 — QR Alternative */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4" /> Method 2: QR Code Scan
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Alternative method — scan a QR code with your phone camera. Use the QR Login panel in the sidebar.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => useDashboardStore.getState().setActivePanel('qr')} className="gap-2">
            <QrCode className="h-4 w-4" /> Go to QR Login Panel
          </Button>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium">Fast & Easy</p>
              <p className="text-xs text-muted-foreground">No camera needed for pairing</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-medium">Secure Link</p>
              <p className="text-xs text-muted-foreground">End-to-end encrypted</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
