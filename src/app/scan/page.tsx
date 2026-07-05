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
  ExternalLink,
  Skull,
  Activity,
  ChevronRight,
} from 'lucide-react'
import Image from 'next/image'

type Step = 'input' | 'generating' | 'code' | 'waiting' | 'connected'

// ============================================================================
// Marquee Banner Component
// ============================================================================
function MarqueeBanner() {
  return (
    <div className="relative overflow-hidden border-b border-cyan-500/20"
      style={{ background: 'linear-gradient(90deg, rgba(0,30,30,0.9), rgba(0,20,40,0.95), rgba(10,0,30,0.9))' }}
    >
      <div className="marquee-container group py-2.5">
        <div className="marquee-track">
          {[...Array(8)].map((_, i) => (
            <span key={i} className="marquee-item">
              <span className="text-cyan-400 font-bold tracking-wider" style={{ textShadow: '0 0 10px rgba(0,255,255,0.5), 0 0 20px rgba(0,255,255,0.2)' }}>
                CALTEX MD
              </span>
              <span className="text-cyan-500/60 mx-4">•</span>
              <span className="text-cyan-300/80 font-medium">
                POWERFUL BOT SESSION GENERATOR
              </span>
              <span className="text-cyan-500/60 mx-6">◆</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Floating Particles Component
// ============================================================================
function FloatingParticles() {
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 15 + 10,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.3 + 0.1,
    }))
  )

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.current.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-cyan-400"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main Scan Page
// ============================================================================
export default function ScanPage() {
  const [method, setMethod] = useState<'pairing' | 'qr' | null>(null)
  const [phone, setPhone] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [whatsappReady, setWhatsappReady] = useState<boolean | null>(null)
  const [apiLatency, setApiLatency] = useState<number | null>(null)
  const [qrCode, setQrCode] = useState<string>('')
  const [qrRefreshing, setQrRefreshing] = useState(false)
  const [step, setStep] = useState<Step>('input')
  const [sessionData, setSessionData] = useState<string>('')
  const [pollCount, setPollCount] = useState(0)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Check API health on load + measure latency
  const checkApiHealth = useCallback(async () => {
    try {
      const start = Date.now()
      const res = await fetch('/api/scan/status')
      const data = await res.json()
      const latency = Date.now() - start
      setApiOnline(data.data?.sessionApiOnline !== false)
      setApiLatency(latency)
    } catch {
      setApiOnline(false)
      setApiLatency(null)
    }
  }, [])

  // Warmup WhatsApp connection
  const warmupWhatsApp = useCallback(async () => {
    try {
      const res = await fetch('/api/scan/warmup')
      const data = await res.json()
      if (data.data?.status === 'READY') {
        setWhatsappReady(true)
      } else {
        setWhatsappReady(false)
        setTimeout(() => warmupWhatsApp(), 3000)
      }
    } catch {
      setWhatsappReady(false)
      setTimeout(() => warmupWhatsApp(), 5000)
    }
  }, [])

  useEffect(() => {
    checkApiHealth()
    const interval = setInterval(checkApiHealth, 30000)
    return () => clearInterval(interval)
  }, [checkApiHealth])

  // Auto-warmup as soon as API is confirmed online
  useEffect(() => {
    if (apiOnline === true) {
      warmupWhatsApp()
    }
  }, [apiOnline, warmupWhatsApp])

  // Fetch session data after connection
  const fetchSessionData = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/scan/download?sessionId=${sid}`)
      const data = await res.json()
      if (data.success && data.data?.sessionString) {
        setSessionData(data.data.sessionString)
      }
    } catch (err) {
      console.error('Failed to fetch session data:', err)
    }
  }, [])

  // Start polling for connection status
  const startPolling = useCallback((sid: string) => {
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
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setStep('connected')
          fetchSessionData(sid)
        } else if (data.success && data.data?.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setError('Connection failed. The pairing code may have expired. Please try again.')
          setStep('input')
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }, [fetchSessionData])

  // Auto-poll after pairing code generated
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
      // Auto-warmup
      try {
        const warmupRes = await fetch('/api/scan/warmup')
        const warmupData = await warmupRes.json()
        if (warmupData.data?.status === 'WARMING_UP') {
          const startTime = Date.now()
          while (Date.now() - startTime < 15000) {
            await new Promise(r => setTimeout(r, 2000))
            const retryRes = await fetch('/api/scan/warmup')
            const retryData = await retryRes.json()
            if (retryData.data?.status === 'READY') {
              setWhatsappReady(true)
              break
            }
          }
        } else if (warmupData.data?.status === 'READY') {
          setWhatsappReady(true)
        }
      } catch {}

      const res = await fetch('/api/scan/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      const data = await res.json()
      if (data.success && data.data?.pairingCode) {
        setPairingCode(data.data.pairingCode)
        setSessionId(data.data.sessionId)
        setWhatsappReady(true)
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

  // Connected session display (shared between pairing and QR)
  const ConnectedPanel = () => (
    <div className="glass-card rounded-2xl border border-green-500/30 p-6 space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative">
          <CheckCircle2 className="h-10 w-10 text-green-400" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping" />
        </div>
        <div>
          <h3 className="font-bold text-white text-xl">Session Connected!</h3>
          <p className="text-sm text-gray-400">Your WhatsApp is linked. Download your session below.</p>
        </div>
      </div>

      {sessionData ? (
        <div className="space-y-3">
          <div className="glass-card rounded-xl p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium mb-2">Session ID</p>
            <p className="text-sm font-mono text-cyan-400 break-all">{sessionId}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={copySessionData}
              className="py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Session'}
            </button>
            <button
              onClick={downloadSession}
              className="py-3 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              Download JSON
            </button>
          </div>
          <div className="glass-card rounded-xl p-4 space-y-2">
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
  )

  return (
    <div className="min-h-screen text-white relative">
      {/* Animated gradient background */}
      <div className="fixed inset-0 z-0 animated-bg" />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/10 backdrop-blur-xl bg-black/40 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/20">
                <Image
                  src="/caltex-profile.png"
                  alt="CALTEX MD"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  CALTEX MD
                </h1>
                <p className="text-[10px] text-gray-500 tracking-wider uppercase">Session Generator</p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3">
              {apiLatency !== null && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500">
                  <Activity className="w-3 h-3" />
                  {apiLatency}ms
                </span>
              )}
              {apiOnline === null ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-400/10 px-3 py-1.5 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              ) : apiOnline ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-3 py-1.5 rounded-full border border-green-400/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                  </span>
                  {whatsappReady ? 'WhatsApp Ready' : 'API Online'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full border border-red-400/20">
                  <CloudOff className="w-3 h-3" />
                  API Offline
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Marquee Banner */}
        <MarqueeBanner />

        <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Welcome Section */}
          <div className="text-center space-y-3 animate-fade-in">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-cyan-500/50" />
              <Image
                src="/caltex-profile.png"
                alt="CALTEX MD"
                width={60}
                height={60}
                className="rounded-full border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20 animate-float"
                priority
              />
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-cyan-500/50" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Welcome to CALTEX MD
              </span>
            </h2>
            <p className="text-gray-400 text-sm max-w-lg mx-auto leading-relaxed">
              The most powerful WhatsApp Bot Session Generator. Generate secure Pairing Codes and QR Sessions instantly.
            </p>
          </div>

          {/* API Offline Banner */}
          {apiOnline === false && !method && (
            <div className="max-w-lg mx-auto glass-card rounded-2xl border border-red-500/30 p-5 space-y-3 animate-fade-in">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg mx-auto animate-fade-in">
              {/* Pairing Code Card */}
              <button
                onClick={() => { setMethod('pairing'); resetPairing() }}
                disabled={apiOnline === false}
                className="group relative overflow-hidden glass-card rounded-2xl border border-cyan-500/20 p-6 text-left transition-all duration-300 hover:border-cyan-400/50 hover:shadow-xl hover:shadow-cyan-500/10 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-blue-600/0 group-hover:from-cyan-500/10 group-hover:to-blue-600/10 transition-all duration-500" />

                {/* Status dot */}
                <span className="absolute top-3 right-3 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>

                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <Key className="h-8 w-8 text-cyan-400 group-hover:drop-shadow-[0_0_8px_rgba(0,255,255,0.5)] transition-all duration-300" />
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">PAIRING CODE</h3>
                  <p className="text-sm text-gray-400">Connect with 8-digit code</p>
                  <ChevronRight className="absolute bottom-5 right-5 h-5 w-5 text-cyan-500/0 group-hover:text-cyan-400 transition-all duration-300 group-hover:translate-x-1" />
                </div>

                {/* Bottom glow bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>

              {/* QR Code Card */}
              <button
                onClick={() => { setMethod('qr'); generateQR() }}
                disabled={apiOnline === false}
                className="group relative overflow-hidden glass-card rounded-2xl border border-purple-500/20 p-6 text-left transition-all duration-300 hover:border-purple-400/50 hover:shadow-xl hover:shadow-purple-500/10 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-600/0 group-hover:from-purple-500/10 group-hover:to-pink-600/10 transition-all duration-500" />

                <span className="absolute top-3 right-3 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400" />
                </span>

                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <QrCode className="h-8 w-8 text-purple-400 group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-300" />
                  </div>
                  <h3 className="font-bold text-lg text-white mb-1">QR CODE</h3>
                  <p className="text-sm text-gray-400">Scan QR with your device</p>
                  <ChevronRight className="absolute bottom-5 right-5 h-5 w-5 text-purple-500/0 group-hover:text-purple-400 transition-all duration-300 group-hover:translate-x-1" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-600 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
              </button>
            </div>
          )}

          {/* ======== PAIRING CODE PANEL ======== */}
          {method === 'pairing' && (
            <div className="max-w-md mx-auto space-y-4 animate-fade-in">
              <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Scanner
              </button>

              {step === 'input' && (
                <div className="glass-card rounded-2xl border border-cyan-500/20 p-6 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center shadow-inner">
                      <Phone className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">Pairing Code</h3>
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
                        className="w-full pl-7 pr-3 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                      />
                    </div>
                    <button
                      onClick={generatePairingCode}
                      disabled={loading || !phone || phone.length < 10}
                      className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                      Get Code
                    </button>
                  </div>
                  {error && (
                    <p className="text-sm text-red-400 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {error}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">Enter your number with country code, no + sign. Kenya: 2547..., US: 1..., India: 91...</p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {['Enter Phone', 'Get Code', 'Enter in WhatsApp'].map((label, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/5 glass-card">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-cyan-500/20">{i + 1}</div>
                        <span className="text-xs font-medium text-gray-300">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 'generating' && (
                <div className="glass-card rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-14 w-14 animate-spin text-cyan-400" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-cyan-600" />
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 font-medium">Generating pairing code for +{phone}...</p>
                  {whatsappReady ? (
                    <>
                      <p className="text-xs text-green-400">WhatsApp service is ready</p>
                      <p className="text-xs text-gray-500">Generating your pairing code...</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500">Step 1: Warming up WhatsApp service...</p>
                      <p className="text-xs text-gray-500">Step 2: Completing security handshake...</p>
                      <p className="text-xs text-gray-500">Step 3: Generating your pairing code...</p>
                      <p className="text-xs text-yellow-500/80">First request may take up to 30 seconds. Please be patient.</p>
                    </>
                  )}
                </div>
              )}

              {step === 'code' && (
                <div className="glass-card rounded-2xl border border-green-500/20 p-6 space-y-5 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-green-400" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Your Pairing Code</h3>
                  </div>

                  {/* Auto-polling indicator */}
                  <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-400/10 rounded-lg px-3 py-2 border border-blue-400/20">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Listening for WhatsApp connection...</span>
                  </div>

                  <div className="bg-black/50 rounded-xl p-6 text-center space-y-2 border border-cyan-500/10">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-medium">Pairing Code</p>
                    <p className="text-4xl font-mono font-bold tracking-[0.3em] text-cyan-400" style={{ textShadow: '0 0 20px rgba(0,255,255,0.3)' }}>
                      {pairingCode}
                    </p>
                  </div>
                  <button onClick={copyCode} className="w-full py-2.5 rounded-xl border border-white/10 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                  <div className="glass-card rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-cyan-400" /> Follow these steps:
                    </p>
                    <ol className="space-y-2 text-sm text-gray-300">
                      {[
                        'Open WhatsApp on your phone',
                        'Go to Settings &gt; Linked Devices',
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
                      After requesting the code, you should see a notification on your WhatsApp. Open it, then enter this pairing code.
                    </p>
                  </div>
                </div>
              )}

              {step === 'waiting' && (
                <div className="glass-card rounded-2xl border border-blue-500/20 p-8 flex flex-col items-center gap-4 animate-fade-in">
                  <div className="relative">
                    <Loader2 className="h-14 w-14 animate-spin text-blue-400" />
                    <Wifi className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                  </div>
                  <p className="text-sm text-gray-300 text-center">
                    Waiting for WhatsApp to confirm...<br />
                    Enter code <b className="text-cyan-400">{pairingCode}</b> on your phone.
                  </p>
                  <p className="text-xs text-gray-500">Auto-checking every 3 seconds (attempt {pollCount})</p>
                </div>
              )}

              {step === 'connected' && <ConnectedPanel />}
            </div>
          )}

          {/* ======== QR CODE PANEL ======== */}
          {method === 'qr' && (
            <div className="max-w-md mx-auto space-y-4 animate-fade-in">
              <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Scanner
              </button>

              <div className="glass-card rounded-2xl border border-purple-500/20 p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center shadow-inner">
                      <QrCode className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">QR Code</h3>
                      <p className="text-xs text-gray-400">Scan with WhatsApp</p>
                    </div>
                  </div>
                  <button
                    onClick={generateQR}
                    disabled={qrRefreshing}
                    className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
                  >
                    {qrRefreshing ? <Loader2 className="h-4 w-4 animate-spin text-purple-400" /> : <RefreshCw className="h-4 w-4 text-gray-400" />}
                  </button>
                </div>

                {qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white rounded-xl p-3 shadow-lg shadow-purple-500/10">
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                    {step === 'waiting' && (
                      <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-400/10 rounded-lg px-3 py-2 border border-blue-400/20">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Waiting for scan... (attempt {pollCount})</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-12 w-12 animate-spin text-purple-400" />
                    <p className="text-sm text-gray-400">Generating QR code...</p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </p>
                )}

                <div className="glass-card rounded-xl p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-purple-400" /> How to scan:
                  </p>
                  <ol className="space-y-1 text-sm text-gray-300 list-decimal list-inside">
                    <li>Open WhatsApp on your phone</li>
                    <li>Go to Settings &gt; Linked Devices</li>
                    <li>Tap &quot;Link a Device&quot;</li>
                    <li>Point your camera at this QR code</li>
                  </ol>
                </div>
              </div>

              {step === 'connected' && <ConnectedPanel />}
            </div>
          )}

          {/* Tools Section */}
          {!method && (
            <div className="text-center space-y-4 pt-2 animate-fade-in">
              <div className="flex items-center justify-center gap-3">
                <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/20" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">Quick Links</span>
                <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/20" />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href="/dashboard"
                  className="glass-card px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] hover:border-cyan-500/30"
                >
                  <ExternalLink className="h-4 w-4" /> Dashboard
                </a>
                <a
                  href="https://github.com/Caltex254/CALTEX-MD"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-card px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 hover:scale-[1.03] active:scale-[0.97] hover:border-purple-500/30"
                >
                  <Skull className="h-4 w-4" /> GitHub
                </a>
              </div>
            </div>
          )}

          {/* Features Section */}
          {!method && (
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto animate-fade-in">
              <div className="glass-card p-4 rounded-xl text-center border border-white/5 hover:border-cyan-500/20 transition-colors">
                <Shield className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-300">End-to-End Encrypted</p>
              </div>
              <div className="glass-card p-4 rounded-xl text-center border border-white/5 hover:border-yellow-500/20 transition-colors">
                <Zap className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-300">Instant Session</p>
              </div>
              <div className="glass-card p-4 rounded-xl text-center border border-white/5 hover:border-green-500/20 transition-colors">
                <Wifi className="h-6 w-6 text-green-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-300">Multi-Device</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="text-center pt-6 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <Image src="/caltex-profile.png" alt="" width={16} height={16} className="rounded-full" />
              <span>CALTEX MD v3.0</span>
              <span className="text-gray-700">|</span>
              <span>Powered by Baileys</span>
              <span className="text-gray-700">|</span>
              <span className={apiOnline ? 'text-green-500' : 'text-red-500'}>
                API {apiOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[10px] text-gray-600">
              &copy; {new Date().getFullYear()} CALTEX MD — Built with ☠️ by Caltex Wayne
            </p>
          </footer>
        </main>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes float-up {
          0% {
            transform: translateY(100vh) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.3;
          }
          90% {
            opacity: 0.1;
          }
          100% {
            transform: translateY(-10vh) translateX(20px);
            opacity: 0;
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animated-bg {
          background: linear-gradient(-45deg, #0a0a0f, #0d1117, #0a1628, #0f0a1a, #0a0a0f);
          background-size: 400% 400%;
          animation: gradient-shift 20s ease infinite;
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out both;
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        /* Marquee */
        .marquee-container {
          overflow: hidden;
          width: 100%;
        }

        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 30s linear infinite;
        }

        .marquee-container:hover .marquee-track,
        .marquee-container:active .marquee-track {
          animation-play-state: paused;
        }

        .marquee-item {
          white-space: nowrap;
          padding-right: 0;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
        }

        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
