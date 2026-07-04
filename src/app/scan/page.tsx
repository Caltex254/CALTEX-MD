'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  CloudOff,
  Download,
  FileJson,
  AlertTriangle,
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
  const [pollCount, setPollCount] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

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

  // Fetch session data after connection
  const fetchSessionData = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/scan/download?sessionId=${sid}`)
      const data = await res.json()
      if (data.success && data.data?.sessionString) {
        setSessionData(data.data.sessionString)
      } else if (data.error) {
        // Session might not be ready yet, retry after a delay
        console.log('Session data not ready yet:', data.error)
      }
    } catch (err) {
      console.error('Failed to fetch session data:', err)
    }
  }, [])

  // Start polling for connection status
  const startPolling = useCallback((sid: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    setPollCount(0)

    pollingRef.current = setInterval(async () => {
      setPollCount(prev => prev + 1)
      try {
        const res = await fetch(`/api/scan/qr?sessionId=${sid}`)
        const data = await res.json()

        if (data.success && data.data?.status === 'connected') {
          // Connected! Stop polling and update UI
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setStep('connected')
          // Fetch session data
          fetchSessionData(sid)
        } else if (data.success && data.data?.status === 'failed') {
          // Connection failed
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setError('Connection failed. The pairing code may have expired. Please try again.')
          setStep('input')
        }
      } catch {
        // Network error, keep polling
      }
    }, 3000)
  }, [fetchSessionData])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // CRITICAL FIX: Start polling IMMEDIATELY after pairing code is generated
  // Don't wait for user to click "I've entered the code"
  useEffect(() => {
    if ((step === 'code' || step === 'waiting') && sessionId && method === 'pairing') {
      startPolling(sessionId)
    }
    return () => {
      if (step !== 'code' && step !== 'waiting' && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, sessionId, method, startPolling])

  // Also poll for QR code connection
  useEffect(() => {
    if (step === 'waiting' && sessionId && method === 'qr') {
      startPolling(sessionId)
    }
    return () => {
      if (step !== 'waiting' && pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [step, sessionId, method, startPolling])

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
        // Go directly to 'code' step - polling starts automatically via useEffect
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
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setStep('input')
    setPairingCode('')
    setSessionId('')
    setError('')
    setSessionData('')
    setPollCount(0)
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
                      placeholder="254712345678 (country code + number)"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && generatePairingCode()}
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
                <p className="text-xs text-gray-500">Enter your number with country code, no + sign. Kenya: 2547..., US: 1..., India: 91...</p>
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
                <p className="text-xs text-gray-500">Step 1: Connecting to WhatsApp servers...</p>
                <p className="text-xs text-gray-500">Step 2: Completing security handshake...</p>
                <p className="text-xs text-gray-500">Step 3: Generating your pairing code...</p>
                <p className="text-xs text-yellow-500/80">This may take up to 90 seconds on first request (server wake-up). Please be patient.</p>
              </div>
            )}

            {step === 'code' && (
              <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-teal-900/40 to-teal-950/60 p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-green-400" />
                  <h3 className="font-bold text-white">Your Pairing Code</h3>
                </div>

                {/* Auto-polling indicator */}
                <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-400/10 rounded-lg px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Listening for WhatsApp connection...</span>
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
                    {[
                      'Open WhatsApp on your phone',
                      'Go to Settings > Linked Devices',
                      'Tap "Link a Device"',
                      'Tap "Link with phone number"',
                      `Enter this code: ${pairingCode}`,
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                        <span dangerouslySetInnerHTML={{ __html: text.replace(pairingCode, `<b class="text-cyan-400">${pairingCode}</b>`) }} />
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
                  <p className="text-xs text-yellow-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    After requesting the code, you should see a notification on your WhatsApp. Open it, then enter this pairing code. If you don't see a notification, go to WhatsApp &gt; Settings &gt; Linked Devices &gt; Link a Device &gt; Link with phone number.
                  </p>
                </div>
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
                  {method === 'pairing' && <>Enter code <b className="text-cyan-400">{pairingCode}</b> on your phone.</>}
                </p>
                <p className="text-xs text-gray-500">Auto-checking every 3 seconds (attempt {pollCount})</p>
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
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={copySessionData}
                        className="py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all"
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Session'}
                      </button>
                      <button
                        onClick={downloadSession}
                        className="py-3 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download JSON
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-cyan-400" /> How to use your session:
                      </p>
                      <ol className="space-y-1 text-sm text-gray-300 list-decimal list-inside">
                        <li>Copy or download the session data above</li>
                        <li>Set it as the <code className="bg-black/40 px-1 rounded text-cyan-400">SESSION_DATA</code> environment variable</li>
                        <li>Deploy the CALTEX MD bot — it will auto-connect using this session</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching session data...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ======== QR CODE PANEL ======== */}
        {method === 'qr' && (
          <div className="max-w-md mx-auto space-y-4">
            <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors">
              ← Back to Scanner
            </button>

            {/* QR Display */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-purple-950/60 p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">QR Code</h3>
                  <p className="text-xs text-gray-400">Scan with WhatsApp</p>
                </div>
              </div>

              {qrCode ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white rounded-xl p-3">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>

                  {step === 'waiting' && (
                    <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-400/10 rounded-lg px-3 py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Waiting for scan... (attempt {pollCount})</span>
                    </div>
                  )}

                  <button
                    onClick={generateQR}
                    disabled={qrRefreshing}
                    className="py-2.5 px-4 rounded-xl border border-white/10 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
                  >
                    {qrRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Refresh QR
                  </button>

                  <div className="bg-white/5 rounded-xl p-4 w-full space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-purple-400" /> How to scan:
                    </p>
                    <ol className="space-y-1 text-sm text-gray-300 list-decimal list-inside">
                      <li>Open WhatsApp on your phone</li>
                      <li>Go to Settings > Linked Devices</li>
                      <li>Tap "Link a Device"</li>
                      <li>Point your camera at this QR code</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                  <p className="text-sm text-gray-400">Generating QR code...</p>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                  {error}
                </p>
              )}
            </div>

            {/* QR Connected State */}
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
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={copySessionData}
                        className="py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all"
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Session'}
                      </button>
                      <button
                        onClick={downloadSession}
                        className="py-3 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download JSON
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <FileJson className="h-4 w-4 text-cyan-400" /> How to use your session:
                      </p>
                      <ol className="space-y-1 text-sm text-gray-300 list-decimal list-inside">
                        <li>Copy or download the session data above</li>
                        <li>Set it as the <code className="bg-black/40 px-1 rounded text-cyan-400">SESSION_DATA</code> environment variable</li>
                        <li>Deploy the CALTEX MD bot — it will auto-connect using this session</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Fetching session data...
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Info */}
        <div className="max-w-lg mx-auto text-center space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <Shield className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-300">End-to-End Encrypted</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <Zap className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-300">Instant Session</p>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <Wifi className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-300">Multi-Device</p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            CALTEX MD v3.0 • Powered by Baileys • Session data is never stored on our servers
          </p>
        </div>
      </main>
    </div>
  )
}
