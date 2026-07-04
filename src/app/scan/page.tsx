'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Smartphone,
  QrCode,
  Key,
  RefreshCw,
  Copy,
  CheckCircle2,
  Loader2,
  Shield,
  Zap,
  Wifi,
  WifiOff,
  Phone,
  ArrowRight,
  ExternalLink,
  Skull,
  CloudOff,
  Server,
} from 'lucide-react'

type BotStatus = 'connected' | 'disconnected' | 'connecting' | 'qr' | 'offline' | 'unknown'

export default function ScanPage() {
  const [method, setMethod] = useState<'pairing' | 'qr' | null>(null)
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [botStatus, setBotStatus] = useState<BotStatus>('unknown')
  const [qrCode, setQrCode] = useState<string>('')
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const [step, setStep] = useState<'input' | 'generating' | 'code' | 'waiting' | 'connected'>('input')

  // Fetch bot status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/status')
      const data = await res.json()
      if (data.success) {
        const status = data.data?.status || 'unknown'
        setBotStatus(status as BotStatus)
        if (data.data?.qrCode) setQrCode(data.data.qrCode)
      }
    } catch {
      setBotStatus('offline')
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  // Auto-check connection during pairing wait
  useEffect(() => {
    if (step !== 'waiting') return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/scan/status')
        const data = await res.json()
        if (data.success && data.data?.status === 'connected') {
          setBotStatus('connected')
          setStep('connected')
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [step])

  const generatePairingCode = async () => {
    if (!phone || phone.length < 10) return
    setLoading(true)
    setError('')
    setPairingCode('')
    setStep('generating')

    try {
      const res = await fetch('/api/scan/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      const data = await res.json()
      if (data.success && data.data?.pairingCode) {
        setPairingCode(data.data.pairingCode)
        setStep('code')
      } else {
        const errMsg = data.error || 'Failed to generate pairing code'
        // Add hint if available
        const hint = data.hint ? `\n\n💡 ${data.hint}` : ''
        setError(errMsg + hint)
        setStep('input')
      }
    } catch {
      setError('Network error — please check your connection and try again')
      setStep('input')
    }
    setLoading(false)
  }

  const refreshQr = async () => {
    setQrRefreshing(true)
    try {
      await fetch('/api/scan/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      await fetchStatus()
    } catch {} finally {
      setQrRefreshing(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetPairing = () => {
    setStep('input')
    setPairingCode('')
    setError('')
  }

  const isOffline = botStatus === 'offline'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              CT
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                CALTEX MD SCANNER
              </h1>
              <p className="text-xs text-gray-400">WhatsApp Bot Session Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {botStatus === 'connected' ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Connected
              </span>
            ) : isOffline ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full">
                <CloudOff className="w-3 h-3" />
                Bot Offline
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Disconnected
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Scanner Section */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <span className="text-cyan-400">◆</span>
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">SCANNER</span>
            <span className="text-cyan-400">◆</span>
          </h2>
          <p className="text-gray-400 text-sm">Choose a method to link your WhatsApp</p>
        </div>

        {/* Bot Offline Banner */}
        {isOffline && !method && (
          <div className="max-w-lg mx-auto rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-900/30 to-red-950/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <CloudOff className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Bot Service Offline</h3>
                <p className="text-xs text-gray-400">The WhatsApp bot service is not running</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              To generate pairing codes and QR codes, the bot service must be deployed and running. Follow the steps below:
            </p>
            <div className="bg-black/30 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-cyan-400">📋 Setup Steps:</p>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Deploy the bot on <b className="text-white">Render</b>, <b className="text-white">Railway</b>, or a <b className="text-white">VPS</b></li>
                <li>Set the <code className="bg-white/10 px-1 rounded text-cyan-300">BOT_API_URL</code> env var on Vercel to your bot URL</li>
                <li>Redeploy on Vercel — the scanner will then connect to your bot</li>
              </ol>
            </div>
            <a
              href="https://github.com/Caltex254/CALTEX-MD#-quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Server className="h-3.5 w-3.5" /> View deployment guide on GitHub
            </a>
          </div>
        )}

        {/* Method Cards */}
        {!method && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            {/* Pairing Code Card */}
            <button
              onClick={() => setMethod('pairing')}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-900/60 to-teal-950/80 p-6 text-left transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-4">
                <Key className="h-7 w-7 text-cyan-400" />
              </div>
              <h3 className="font-bold text-lg text-white">PAIRING CODE</h3>
              <p className="text-sm text-gray-400 mt-1">Connect with 8-digit code</p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* QR Code Card */}
            <button
              onClick={() => { setMethod('qr'); refreshQr() }}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/60 to-purple-950/80 p-6 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center mb-4">
                <QrCode className="h-7 w-7 text-purple-400" />
              </div>
              <h3 className="font-bold text-lg text-white">QR CODE</h3>
              <p className="text-sm text-gray-400 mt-1">Scan QR with your device</p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        )}

        {/* Pairing Code Panel */}
        {method === 'pairing' && (
          <div className="max-w-md mx-auto space-y-4">
            <button
              onClick={() => { setMethod(null); resetPairing() }}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              ← Back to Scanner
            </button>

            {step === 'input' && (
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-teal-900/40 to-teal-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">Pairing Code</h3>
                    <p className="text-xs text-gray-400">Enter your WhatsApp phone number</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+</span>
                    <input
                      type="text"
                      placeholder="Phone with country code (e.g. 254712345678)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full pl-7 pr-3 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
                    />
                  </div>
                  <button
                    onClick={generatePairingCode}
                    disabled={loading || !phone || phone.length < 10}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Get Code
                  </button>
                </div>
                {error && (
                  <div className="text-sm text-red-400 flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <span className="whitespace-pre-line">{error}</span>
                  </div>
                )}

                {/* Steps preview */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {['Enter Phone', 'Get Code', 'Enter in WhatsApp'].map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <span className="text-xs font-medium text-gray-300">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'generating' && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
                <p className="text-sm text-gray-400">Requesting pairing code for +{phone}...</p>
              </div>
            )}

            {step === 'code' && (
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-teal-900/40 to-teal-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-green-400" />
                  <h3 className="font-bold text-white">Your Pairing Code</h3>
                </div>

                {/* Code Display */}
                <div className="bg-black/50 rounded-xl p-6 text-center space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Pairing Code</p>
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-cyan-400">{pairingCode}</p>
                </div>

                <button
                  onClick={copyCode}
                  className="w-full py-2.5 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>

                {/* Instructions */}
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-cyan-400" /> Follow these steps:
                  </p>
                  <ol className="space-y-2 text-sm text-gray-300">
                    {[
                      'Open WhatsApp on your phone',
                      'Go to Settings > Linked Devices',
                      'Tap "Link a Device"',
                      'Tap "Link with phone number"',
                      `Enter this code: ${pairingCode}`,
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: text.replace(pairingCode, `<b class="text-cyan-400">${pairingCode}</b>`) }} />
                      </li>
                    ))}
                  </ol>
                </div>

                <button
                  onClick={() => setStep('waiting')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:from-green-400 hover:to-emerald-500 transition-all"
                >
                  I've entered the code <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {step === 'waiting' && (
              <div className="rounded-2xl border border-blue-500/30 bg-black/40 p-8 flex flex-col items-center gap-4">
                <div className="relative">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
                  <Wifi className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  Waiting for WhatsApp to confirm...<br />
                  Enter code <b className="text-cyan-400">{pairingCode}</b> on your phone.
                </p>
              </div>
            )}

            {step === 'connected' && (
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-green-950/60 p-8 flex flex-col items-center gap-4">
                <CheckCircle2 className="h-16 w-16 text-green-400" />
                <div className="text-center">
                  <p className="font-bold text-lg text-white">Device Paired!</p>
                  <p className="text-sm text-gray-400 mt-1">Your WhatsApp is now linked to CALTEX MD.</p>
                </div>
                <button
                  onClick={() => { setMethod(null); resetPairing() }}
                  className="px-6 py-2.5 rounded-xl bg-green-500 text-white font-medium text-sm hover:bg-green-400 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}

        {/* QR Code Panel */}
        {method === 'qr' && (
          <div className="max-w-md mx-auto space-y-4">
            <button
              onClick={() => setMethod(null)}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              ← Back to Scanner
            </button>

            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-purple-950/60 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <QrCode className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">QR Code</h3>
                    <p className="text-xs text-gray-400">Scan with WhatsApp</p>
                  </div>
                </div>
                <button
                  onClick={refreshQr}
                  disabled={qrRefreshing}
                  className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                >
                  {qrRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-purple-400" /> : <RefreshCw className="h-4 w-4 text-gray-400" />}
                </button>
              </div>

              <div className="w-64 h-64 mx-auto rounded-xl border-2 border-dashed border-white/10 flex items-center justify-center bg-black/30">
                {qrCode ? (
                  <img src={qrCode} alt="QR Code" className="w-full h-full p-4 rounded-lg" />
                ) : botStatus === 'connected' ? (
                  <div className="text-center text-green-400">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Already Connected</p>
                  </div>
                ) : isOffline ? (
                  <div className="text-center text-red-400">
                    <CloudOff className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Bot offline</p>
                    <p className="text-xs text-gray-500 mt-1">Deploy bot service first</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <QrCode className="h-12 w-12 mx-auto mb-2" />
                    <p className="text-sm">Click refresh to generate</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center">
                WhatsApp → Settings → Linked Devices → Link a Device → Scan this QR
              </p>
            </div>
          </div>
        )}

        {/* Tools Section */}
        <div className="text-center space-y-4 pt-4">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <span className="text-cyan-400">◆</span>
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">TOOLS</span>
            <span className="text-cyan-400">◆</span>
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" /> Dashboard
            </a>
            <a
              href="https://github.com/Caltex254/CALTEX-MD"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
            >
              <Skull className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center pt-6 border-t border-white/5">
          <p className="text-xs text-gray-500">
            Built with <span className="text-gray-400">☠️</span> by Caltex Wayne — TECH WIZARD
          </p>
        </footer>
      </main>
    </div>
  )
}
