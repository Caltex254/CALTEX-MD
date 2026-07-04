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
  Phone,
  ArrowRight,
  ExternalLink,
  Skull,
  CloudOff,
  Download,
  FileJson,
} from 'lucide-react'

type Step = 'input' | 'generating' | 'code' | 'waiting' | 'connected'

export default function ScanPage() {
  const [method, setMethod] = useState<'pairing' | 'qr' | null>(null)
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [qrCode, setQrCode] = useState<string>('')
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const [step, setStep] = useState<Step>('input')
  const [sessionData, setSessionData] = useState<string>('')

  // Check API health on load
  const checkApiHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/status')
      const data = await res.json()
      setApiOnline(data.data?.sessionApiOnline !== false)
    } catch {
      setApiOnline(false)
    }
  }, [])

  useEffect(() => {
    checkApiHealth()
    const interval = setInterval(checkApiHealth, 30000)
    return () => clearInterval(interval)
  }, [checkApiHealth])

  // Poll session status when waiting for connection
  useEffect(() => {
    if (step !== 'waiting' || !sessionId) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scan/qr?sessionId=${sessionId}`)
        const data = await res.json()
        if (data.success && data.data?.status === 'connected') {
          setStep('connected')
          // Fetch session data
          fetchSessionData(sessionId)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [step, sessionId])

  const fetchSessionData = async (sid: string) => {
    try {
      const res = await fetch(`/api/scan/download?sessionId=${sid}`)
      const data = await res.json()
      if (data.success && data.data?.sessionString) {
        setSessionData(data.data.sessionString)
      }
    } catch {}
  }

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
        setSessionId(data.data.sessionId)
        setStep('code')
      } else {
        setError(data.error || 'Failed to generate pairing code')
        setStep('input')
      }
    } catch {
      setError('Network error — please check your connection')
      setStep('input')
    }
    setLoading(false)
  }

  const generateQR = async () => {
    setQrRefreshing(true)
    setError('')
    try {
      const res = await fetch('/api/scan/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (data.success && data.data?.qrCode) {
        setQrCode(data.data.qrCode)
        setSessionId(data.data.sessionId)
        setStep('waiting')
      } else {
        setError(data.error || 'Failed to generate QR code')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setQrRefreshing(false)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(pairingCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copySessionData = () => {
    navigator.clipboard.writeText(sessionData)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadSession = () => {
    const blob = new Blob([sessionData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `caltex-session-${sessionId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const resetPairing = () => {
    setStep('input')
    setPairingCode('')
    setSessionId('')
    setError('')
    setSessionData('')
  }

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
            {apiOnline === null ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-400/10 px-3 py-1.5 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking...
              </span>
            ) : apiOnline ? (
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                API Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full">
                <CloudOff className="w-3 h-3" />
                API Offline
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
          <p className="text-gray-400 text-sm">Choose a method to link your WhatsApp and get your session</p>
        </div>

        {/* API Offline Banner */}
        {apiOnline === false && !method && (
          <div className="max-w-lg mx-auto rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-900/30 to-red-950/50 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <CloudOff className="h-5 w-5 text-red-400" />
              <div>
                <h3 className="font-bold text-white text-sm">Session API Offline</h3>
                <p className="text-xs text-gray-400">The session generation service is waking up</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              Render free tier services sleep after inactivity. The API will be back online in about 30-60 seconds. Please wait and refresh.
            </p>
          </div>
        )}

        {/* Method Cards */}
        {!method && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <button
              onClick={() => { setMethod('pairing'); resetPairing() }}
              disabled={apiOnline === false}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-teal-900/60 to-teal-950/80 p-6 text-left transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-4">
                <Key className="h-7 w-7 text-cyan-400" />
              </div>
              <h3 className="font-bold text-lg text-white">PAIRING CODE</h3>
              <p className="text-sm text-gray-400 mt-1">Connect with 8-digit code</p>
            </button>

            <button
              onClick={() => { setMethod('qr'); generateQR() }}
              disabled={apiOnline === false}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-900/60 to-purple-950/80 p-6 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center mb-4">
                <QrCode className="h-7 w-7 text-purple-400" />
              </div>
              <h3 className="font-bold text-lg text-white">QR CODE</h3>
              <p className="text-sm text-gray-400 mt-1">Scan QR with your device</p>
            </button>
          </div>
        )}

        {/* ======== PAIRING CODE PANEL ======== */}
        {method === 'pairing' && (
          <div className="max-w-md mx-auto space-y-4">
            <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
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
                      placeholder="e.g. 254712345678"
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
                  <p className="text-sm text-red-400 flex items-start gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  {['Enter Phone', 'Get Code', 'Enter in WhatsApp'].map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold">{i + 1}</div>
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
                <div className="bg-black/50 rounded-xl p-6 text-center space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Pairing Code</p>
                  <p className="text-4xl font-mono font-bold tracking-[0.3em] text-cyan-400">{pairingCode}</p>
                </div>
                <button onClick={copyCode} className="w-full py-2.5 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
                <div className="bg-white/5 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-cyan-400" /> Follow these steps:
                  </p>
                  <ol className="space-y-2 text-sm text-gray-300">
                    {['Open WhatsApp on your phone', 'Go to Settings > Linked Devices', 'Tap "Link a Device"', 'Tap "Link with phone number"', `Enter this code: ${pairingCode}`].map((text, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
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
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-green-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <div>
                    <h3 className="font-bold text-white text-lg">Session Connected!</h3>
                    <p className="text-xs text-gray-400">Your WhatsApp is linked. Download your session below.</p>
                  </div>
                </div>

                {sessionData ? (
                  <div className="space-y-3">
                    <div className="bg-black/50 rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Session ID</p>
                      <p className="text-sm font-mono text-cyan-400 break-all">{sessionId}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={copySessionData} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Session'}
                      </button>
                      <button onClick={downloadSession} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all">
                        <Download className="h-4 w-4" />
                        Download JSON
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs font-medium text-cyan-400 mb-1">📋 Next Step:</p>
                      <p className="text-xs text-gray-400">Deploy CALTEX MD bot and paste this session data in your <code className="bg-white/10 px-1 rounded text-cyan-300">SESSION_DATA</code> env variable. The bot will start immediately without another scan.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-green-400" />
                    <p className="text-sm text-gray-400">Fetching session data...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======== QR CODE PANEL ======== */}
        {method === 'qr' && (
          <div className="max-w-md mx-auto space-y-4">
            <button onClick={() => { setMethod(null); setStep('input'); setQrCode(''); setSessionId('') }} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
              ← Back to Scanner
            </button>

            {!qrCode && !error && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-8 flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                <p className="text-sm text-gray-400">Generating QR code...</p>
              </div>
            )}

            {error && !qrCode && (
              <div className="rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-900/30 to-red-950/50 p-6 space-y-4">
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={generateQR} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-600 text-white text-sm font-medium hover:from-purple-400 hover:to-pink-500 transition-all">
                  Try Again
                </button>
              </div>
            )}

            {qrCode && step !== 'connected' && (
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
                  <button onClick={generateQR} disabled={qrRefreshing} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors">
                    {qrRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-purple-400" /> : <RefreshCw className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>

                <div className="w-64 h-64 mx-auto rounded-xl bg-white p-3">
                  <img src={qrCode} alt="QR Code" className="w-full h-full rounded-lg" />
                </div>

                <p className="text-xs text-gray-400 text-center">
                  WhatsApp → Settings → Linked Devices → Link a Device → Scan this QR
                </p>

                {step === 'waiting' && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <p className="text-sm text-gray-400">Waiting for connection...</p>
                  </div>
                )}
              </div>
            )}

            {step === 'connected' && (
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-900/40 to-green-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                  <div>
                    <h3 className="font-bold text-white text-lg">Session Connected!</h3>
                    <p className="text-xs text-gray-400">Download your session below.</p>
                  </div>
                </div>
                {sessionData ? (
                  <div className="space-y-3">
                    <div className="bg-black/50 rounded-xl p-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Session ID</p>
                      <p className="text-sm font-mono text-cyan-400 break-all">{sessionId}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={copySessionData} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Session'}
                      </button>
                      <button onClick={downloadSession} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all">
                        <Download className="h-4 w-4" />
                        Download JSON
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs font-medium text-cyan-400 mb-1">📋 Next Step:</p>
                      <p className="text-xs text-gray-400">Deploy CALTEX MD bot and paste this session data in your <code className="bg-white/10 px-1 rounded text-cyan-300">SESSION_DATA</code> env variable. The bot starts immediately without another scan.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-green-400" />
                    <p className="text-sm text-gray-400">Fetching session data...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tools */}
        <div className="text-center space-y-4 pt-4">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <span className="text-cyan-400">◆</span>
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">TOOLS</span>
            <span className="text-cyan-400">◆</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            <a href="/dashboard" className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Dashboard
            </a>
            <a href="https://github.com/Caltex254/CALTEX-MD" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2">
              <Skull className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>

        <footer className="text-center pt-6 border-t border-white/5">
          <p className="text-xs text-gray-500">Built with ☠️ by Caltex Wayne — TECH WIZARD</p>
        </footer>
      </main>
    </div>
  )
}
