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
  CloudOff,
  Download,
  FileJson,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  PartyPopper,
} from 'lucide-react'
import Image from 'next/image'

type Step = 'input' | 'generating' | 'code' | 'waiting' | 'connected'

// ============================================================================
// Marquee Banner Component
// ============================================================================
function MarqueeBanner() {
  return (
    <div
      className="relative overflow-hidden border-b border-cyan-400/10"
      style={{
        background: 'linear-gradient(90deg, rgba(8,28,58,0.95), rgba(13,43,82,0.9), rgba(8,28,58,0.95))',
      }}
    >
      <div className="marquee-container group py-2">
        <div className="marquee-track">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="marquee-item">
              <span
                className="font-bold tracking-wider"
                style={{
                  color: '#00E5FF',
                  textShadow: '0 0 10px rgba(0,229,255,0.6), 0 0 30px rgba(108,59,255,0.3)',
                  fontSize: '0.7rem',
                }}
              >
                &#9733; CALTEX MD &bull; POWERFUL BOT SESSION GENERATOR &bull; FAST &bull; SECURE &bull; MULTI-DEVICE &bull; INSTANT SESSION &#9733;
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Floating Particles Component (Cyan + Blue + Purple, slow)
// ============================================================================
function FloatingParticles() {
  const particles = useRef(
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      duration: Math.random() * 25 + 18, // slower: 18-43s
      delay: Math.random() * 15,
      opacity: Math.random() * 0.25 + 0.08,
      color: i % 3 === 0 ? '#00E5FF' : i % 3 === 1 ? '#3B82F6' : '#6C3BFF',
    }))
  )

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.current.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            backgroundColor: p.color,
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}40`,
          }}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Aurora Effect behind Welcome section
// ============================================================================
function AuroraEffect() {
  return (
    <div className="aurora-container pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora-layer aurora-1" />
      <div className="aurora-layer aurora-2" />
      <div className="aurora-layer aurora-3" />
    </div>
  )
}

// ============================================================================
// Wave Effects (top and bottom)
// ============================================================================
function WaveEffect({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      className={`wave-container wave-${position} pointer-events-none fixed left-0 right-0 z-[1]`}
    >
      <div className="wave-line wave-line-1" />
      <div className="wave-line wave-line-2" />
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
  const [caltexSessionId, setCaltexSessionId] = useState<string>('')
  const [showGuide, setShowGuide] = useState(false)
  const [showSuccessAnim, setShowSuccessAnim] = useState(false)
  const [pollCount, setPollCount] = useState(0)
  const [pageLoaded, setPageLoaded] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Page load animation
  useEffect(() => {
    const t = setTimeout(() => setPageLoaded(true), 100)
    return () => clearTimeout(t)
  }, [])

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

  // Fetch session data after connection (fallback)
  const fetchSessionData = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/scan/download?sessionId=${sid}`)
      const data = await res.json()
      if (data.success && data.data?.sessionString) {
        setSessionData(data.data.sessionString)
      }
      if (data.data?.caltexSessionId) {
        setCaltexSessionId(data.data.caltexSessionId)
      }
    } catch (err) {
      console.error('Failed to fetch session data:', err)
    }
  }, [])

  // Start polling for connection status
  // The backend /session/:id endpoint returns sessionString
  // when status is 'connected', so we can get it immediately.
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
          // Use sessionString from the polling response directly
          if (data.data.sessionString) {
            setSessionData(data.data.sessionString)
          } else {
            // Fallback: fetch session data separately
            fetchSessionData(sid)
          }
          // Extract CALTEX Session ID from polling response
          if (data.data.caltexSessionId) {
            setCaltexSessionId(data.data.caltexSessionId)
          }
          // Trigger success animation
          setShowSuccessAnim(true)
          setStep('connected')
        } else if (data.success && data.data?.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setError('Connection failed. The pairing code may have expired. Please try again.')
          setStep('input')
        }
        // For waiting_connect, waiting_pairing, waiting_qr: keep polling
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

  const copySessionId = () => {
    navigator.clipboard.writeText(caltexSessionId)
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
    setCaltexSessionId('')
    setShowGuide(false)
    setShowSuccessAnim(false)
    setPollCount(0)
  }

  // Connected session display (shared between pairing and QR)
  const ConnectedPanel = () => (
    <div className="space-y-4 animate-fade-in">
      {/* Success Header with confetti-like animation */}
      <div
        className="glass-card rounded-2xl border p-6 space-y-5 relative overflow-hidden"
        style={{
          borderColor: 'rgba(37,211,102,0.3)',
          boxShadow: '0 0 40px rgba(37,211,102,0.12), 0 0 80px rgba(0,229,255,0.06)',
        }}
      >
        {/* Animated success glow */}
        {showSuccessAnim && (
          <div className="absolute inset-0 pointer-events-none success-glow-anim" />
        )}

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(37,211,102,0.2), rgba(0,229,255,0.15))',
                boxShadow: '0 0 20px rgba(37,211,102,0.3)',
              }}
            >
              <PartyPopper className="h-6 w-6" style={{ color: '#25D366' }} />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-ping" style={{ backgroundColor: '#25D366' }} />
          </div>
          <div>
            <h3
              className="font-bold text-xl"
              style={{
                background: 'linear-gradient(135deg, #25D366, #00E5FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Session Connected!
            </h3>
            <p className="text-sm text-slate-400">Your WhatsApp is linked. Your Session ID has been sent to your WhatsApp.</p>
          </div>
        </div>

        {/* CALTEX Session ID — the star of the show */}
        {caltexSessionId ? (
          <div
            className="rounded-xl p-5 space-y-3 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.08), rgba(108,59,255,0.06), rgba(255,193,7,0.04))',
              border: '1px solid rgba(0,229,255,0.2)',
              boxShadow: '0 0 25px rgba(0,229,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: '#00E5FF' }}>
                🔑 YOUR SESSION ID
              </p>
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: '#25D366',
                  background: 'rgba(37,211,102,0.12)',
                  border: '1px solid rgba(37,211,102,0.2)',
                }}
              >
                Step 1 Complete
              </span>
            </div>
            <div className="flex items-center gap-3">
              <p
                className="text-2xl sm:text-3xl font-mono font-bold tracking-wider flex-1"
                style={{
                  color: '#00E5FF',
                  textShadow: '0 0 20px rgba(0,229,255,0.4), 0 0 40px rgba(108,59,255,0.2)',
                }}
              >
                {caltexSessionId}
              </p>
              <button
                onClick={copySessionId}
                className="p-3 rounded-xl transition-all hover:scale-105 active:scale-95 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #00E5FF, #6C3BFF)',
                  boxShadow: '0 4px 15px rgba(0,229,255,0.3)',
                }}
                title="Copy Session ID"
              >
                {copied ? (
                  <CheckCircle2 className="h-5 w-5 text-white" />
                ) : (
                  <Copy className="h-5 w-5 text-white" />
                )}
              </button>
            </div>
            {copied && (
              <p className="text-xs animate-fade-in" style={{ color: '#25D366' }}>
                ✓ Session ID copied to clipboard!
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating your Session ID...
          </div>
        )}

        {/* Action buttons row */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={copySessionId}
            disabled={!caltexSessionId}
            className="py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #00E5FF, #6C3BFF)',
              boxShadow: '0 4px 15px rgba(0,229,255,0.3)',
            }}
          >
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Session ID'}
          </button>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="py-3 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #6C3BFF, #FFC107)',
              boxShadow: '0 4px 15px rgba(108,59,255,0.3)',
            }}
          >
            <BookOpen className="h-4 w-4" />
            {showGuide ? 'Hide Guide' : 'Deployment Guide'}
          </button>
        </div>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={downloadSession}
            disabled={!sessionData}
            className="py-2.5 rounded-xl border border-white/12 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download JSON
          </button>
          <button
            onClick={copySessionData}
            disabled={!sessionData}
            className="py-2.5 rounded-xl border border-white/12 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <FileJson className="h-4 w-4" />
            Copy Full Session
          </button>
        </div>

        {/* WhatsApp message indicator */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: 'rgba(37,211,102,0.06)',
            border: '1px solid rgba(37,211,102,0.12)',
          }}
        >
          <Smartphone className="h-3.5 w-3.5" style={{ color: '#25D366' }} />
          <span className="text-xs text-slate-400">Onboarding message sent to your WhatsApp with this Session ID</span>
        </div>
      </div>

      {/* Deployment Guide — expandable */}
      {showGuide && (
        <div
          className="glass-card rounded-2xl p-6 space-y-4 animate-fade-in"
          style={{
            border: '1px solid rgba(108,59,255,0.2)',
            boxShadow: '0 0 30px rgba(108,59,255,0.08)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(108,59,255,0.2), rgba(255,193,7,0.12))',
              }}
            >
              <BookOpen className="h-5 w-5" style={{ color: '#9C4DFF' }} />
            </div>
            <div>
              <h4 className="font-bold text-white text-lg">Deployment Guide</h4>
              <p className="text-xs text-slate-400">Step 2 of 2 — Activate your bot</p>
            </div>
          </div>

          <ol className="space-y-3">
            {[
              {
                step: '1',
                title: 'Fork or download the official CALTEX MD repository',
                desc: 'Visit the GitHub repository and fork it to your account, or download the source code.',
              },
              {
                step: '2',
                title: 'Choose your hosting platform',
                desc: 'Deploy to Render, Heroku, Railway, Pterodactyl Panel, a VPS, or any Node.js-supported hosting.',
              },
              {
                step: '3',
                title: 'Find the SESSION_ID environment variable',
                desc: 'During deployment setup, locate the environment variable named SESSION_ID (or SESSION_DATA).',
              },
              {
                step: '4',
                title: 'Paste your Session ID',
                desc: caltexSessionId
                  ? `Set SESSION_ID to: ${caltexSessionId}`
                  : 'Copy the Session ID shown above and paste it as the value.',
              },
              {
                step: '5',
                title: 'Complete deployment',
                desc: 'Finish the deployment process. Your bot will start automatically.',
              },
              {
                step: '6',
                title: 'Bot connects automatically',
                desc: 'Once deployed, your CALTEX MD bot will automatically connect to this WhatsApp account.',
              },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <span
                  className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0 mt-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #00E5FF, #6C3BFF)',
                    boxShadow: '0 2px 8px rgba(0,229,255,0.3)',
                    color: '#081C3A',
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Security warning */}
          <div
            className="rounded-xl p-3"
            style={{
              background: 'rgba(255,193,7,0.06)',
              border: '1px solid rgba(255,193,7,0.12)',
            }}
          >
            <p className="text-xs flex items-start gap-2" style={{ color: '#FFC107' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <b>Important:</b> Keep your Session ID private. Never share it with anyone.
                Anyone with this Session ID may be able to control your bot.
                If compromised, generate a new session immediately.
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#081C3A' }}>
      {/* Animated gradient background */}
      <div className="fixed inset-0 z-0 animated-bg" />

      {/* Wave effects */}
      <WaveEffect position="top" />
      <WaveEffect position="bottom" />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Main content */}
      <div className={`relative z-10 transition-all duration-700 ${pageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Header */}
        <header className="border-b border-white/8 backdrop-blur-xl sticky top-0 z-50" style={{ background: 'rgba(8,28,58,0.85)', boxShadow: '0 1px 20px rgba(0,0,0,0.2)' }}>
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="relative w-11 h-11 rounded-full overflow-hidden shadow-lg"
                style={{
                  border: '2px solid rgba(0,229,255,0.4)',
                  boxShadow: '0 0 15px rgba(0,229,255,0.25), 0 0 30px rgba(108,59,255,0.12)',
                }}
              >
                <Image
                  src="/caltex-profile.png"
                  alt="CALTEX MD"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <h1
                  className="text-xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #00E5FF, #6C3BFF, #FFC107)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  CALTEX MD
                </h1>
                <p className="text-[10px] tracking-wider uppercase" style={{ color: 'rgba(0,229,255,0.5)' }}>Session Generator</p>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-3">
              {apiLatency !== null && (
                <span className="hidden sm:flex items-center gap-1 text-[10px]" style={{ color: 'rgba(0,229,255,0.5)' }}>
                  <Zap className="w-3 h-3" />
                  {apiLatency}ms
                </span>
              )}
              {apiOnline === null ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-400/10 px-3 py-1.5 rounded-full">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking...
                </span>
              ) : apiOnline ? (
                <span
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
                  style={{
                    color: '#25D366',
                    background: 'rgba(37,211,102,0.12)',
                    border: '1px solid rgba(37,211,102,0.25)',
                    boxShadow: '0 0 12px rgba(37,211,102,0.15)',
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#25D366' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#25D366' }} />
                  </span>
                  <Wifi className="w-3 h-3" />
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
          <div className="text-center space-y-4 animate-fade-in relative">
            {/* Aurora effect behind welcome */}
            <div className="absolute inset-0 -top-10 -bottom-10 aurora-glow pointer-events-none" />

            <div className="flex items-center justify-center gap-4 mb-3 relative">
              <div className="h-px w-16" style={{ background: 'linear-gradient(to right, transparent, rgba(0,229,255,0.5))' }} />
              {/* Logo with radial glow */}
              <div className="relative">
                {/* Radial glow behind logo */}
                <div
                  className="absolute inset-0 -m-6 rounded-full animate-logo-glow"
                  style={{
                    background: 'radial-gradient(circle, rgba(0,229,255,0.2) 0%, rgba(108,59,255,0.1) 40%, transparent 70%)',
                  }}
                />
                <div
                  className="relative rounded-full animate-logo-pulse"
                  style={{
                    boxShadow: '0 0 25px rgba(0,229,255,0.35), 0 0 50px rgba(108,59,255,0.15)',
                    border: '2px solid rgba(0,229,255,0.35)',
                    padding: '3px',
                  }}
                >
                  <Image
                    src="/caltex-profile.png"
                    alt="CALTEX MD"
                    width={72}
                    height={72}
                    className="rounded-full"
                    priority
                  />
                </div>
              </div>
              <div className="h-px w-16" style={{ background: 'linear-gradient(to left, transparent, rgba(108,59,255,0.5))' }} />
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold relative">
              <span
                style={{
                  background: 'linear-gradient(135deg, #00E5FF, #6C3BFF, #FFC107)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Welcome to CALTEX MD
              </span>
            </h2>
            <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed relative">
              The most powerful WhatsApp Bot Session Generator. Generate secure Pairing Codes and QR Sessions instantly.
            </p>
          </div>

          {/* API Offline Banner */}
          {apiOnline === false && !method && (
            <div className="max-w-lg mx-auto glass-card rounded-2xl border border-red-500/30 p-5 space-y-3 animate-fade-in" style={{ boxShadow: '0 0 20px rgba(239,68,68,0.1)' }}>
              <div className="flex items-center gap-3">
                <CloudOff className="h-5 w-5 text-red-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Session API Offline</h3>
                  <p className="text-xs text-slate-400">The session generation service is waking up</p>
                </div>
              </div>
              <p className="text-sm text-slate-300">
                Render free tier services sleep after inactivity. The API will be back online in about 30-60 seconds. Please wait and refresh.
              </p>
            </div>
          )}

          {/* Method Cards */}
          {!method && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg mx-auto animate-fade-in">
              {/* Pairing Code Card */}
              <button
                onClick={() => { setMethod('pairing'); resetPairing() }}
                disabled={apiOnline === false}
                className="group relative overflow-hidden glass-card rounded-2xl p-7 text-left transition-all duration-500 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed card-float animate-card-float"
                style={{
                  border: '1px solid rgba(0,229,255,0.18)',
                  boxShadow: '0 0 30px rgba(0,229,255,0.08), 0 0 60px rgba(0,229,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                }}
              >
                {/* Animated gradient border overlay */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(108,59,255,0.08))' }} />

                {/* Ambient glow on hover */}
                <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ boxShadow: '0 0 40px rgba(0,229,255,0.12), 0 0 80px rgba(0,229,255,0.06)' }} />

                {/* Ready indicator */}
                <span className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#25D366' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#25D366' }} />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#25D366' }}>Ready</span>
                </span>

                <div className="relative z-10">
                  <div
                    className="rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(108,59,255,0.12))',
                      width: '72px',
                      height: '72px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 18px rgba(0,229,255,0.12)',
                    }}
                  >
                    <Key
                      className="h-9 w-9 transition-all duration-500"
                      style={{ color: '#00E5FF' }}
                    />
                  </div>
                  <h3 className="font-bold text-xl text-white mb-1.5 tracking-wide">PAIRING CODE</h3>
                  <p className="text-sm text-slate-400">Connect with 8-digit code</p>
                </div>

                {/* Bottom glow bar */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: 'linear-gradient(90deg, #00E5FF, #6C3BFF)' }} />
              </button>

              {/* QR Code Card */}
              <button
                onClick={() => { setMethod('qr'); generateQR() }}
                disabled={apiOnline === false}
                className="group relative overflow-hidden glass-card rounded-2xl p-7 text-left transition-all duration-500 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed card-float animate-card-float"
                style={{
                  border: '1px solid rgba(108,59,255,0.18)',
                  boxShadow: '0 0 30px rgba(108,59,255,0.08), 0 0 60px rgba(108,59,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
                  animationDelay: '0.15s',
                }}
              >
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(135deg, rgba(108,59,255,0.1), rgba(255,193,7,0.06))' }} />

                {/* Ambient glow on hover */}
                <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ boxShadow: '0 0 40px rgba(108,59,255,0.12), 0 0 80px rgba(108,59,255,0.06)' }} />

                {/* Ready indicator */}
                <span className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#25D366' }} />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: '#25D366' }} />
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#25D366' }}>Ready</span>
                </span>

                <div className="relative z-10">
                  <div
                    className="rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500"
                    style={{
                      background: 'linear-gradient(135deg, rgba(108,59,255,0.18), rgba(255,193,7,0.1))',
                      width: '72px',
                      height: '72px',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 18px rgba(108,59,255,0.12)',
                    }}
                  >
                    <QrCode
                      className="h-9 w-9 transition-all duration-500"
                      style={{ color: '#9C4DFF' }}
                    />
                  </div>
                  <h3 className="font-bold text-xl text-white mb-1.5 tracking-wide">QR CODE</h3>
                  <p className="text-sm text-slate-400">Scan QR with your device</p>
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-0.5 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: 'linear-gradient(90deg, #6C3BFF, #FFC107)' }} />
              </button>
            </div>
          )}

          {/* ======== PAIRING CODE PANEL ======== */}
          {method === 'pairing' && (
            <div className="max-w-md mx-auto space-y-4 animate-fade-in">
              <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Scanner
              </button>

              {step === 'input' && (
                <div className="glass-card rounded-2xl p-6 space-y-5" style={{ border: '1px solid rgba(0,229,255,0.15)', boxShadow: '0 0 25px rgba(0,229,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(0,229,255,0.18), rgba(108,59,255,0.12))' }}
                    >
                      <Phone className="h-6 w-6" style={{ color: '#00E5FF' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">Pairing Code</h3>
                      <p className="text-xs text-slate-400">Enter your WhatsApp phone number</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">+</span>
                      <input
                        type="text"
                        placeholder="254712345678 (country code + number)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && generatePairingCode()}
                        className="w-full pl-7 pr-3 py-3.5 rounded-xl bg-black/30 border border-white/12 text-white placeholder-slate-500 text-sm focus:outline-none transition-all"
                      />
                    </div>
                    <button
                      onClick={generatePairingCode}
                      disabled={loading || !phone || phone.length < 10}
                      className="px-5 py-3.5 rounded-xl text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg, #00E5FF, #6C3BFF)',
                        boxShadow: '0 4px 15px rgba(0,229,255,0.3)',
                      }}
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
                  <p className="text-xs text-slate-500">Enter your number with country code, no + sign. Kenya: 2547..., US: 1..., India: 91...</p>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    {['Enter Phone', 'Get Code', 'Enter in WhatsApp'].map((label, i) => (
                      <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-xl glass-card">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: 'linear-gradient(135deg, #00E5FF, #6C3BFF)',
                            boxShadow: '0 2px 8px rgba(0,229,255,0.3)',
                          }}
                        >{i + 1}</div>
                        <span className="text-xs font-medium text-slate-300">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 'generating' && (
                <div className="glass-card rounded-2xl border border-white/10 p-8 flex flex-col items-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-14 w-14 animate-spin" style={{ color: '#00E5FF' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Zap className="h-6 w-6" style={{ color: '#081C3A' }} />
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 font-medium">Generating pairing code for +{phone}...</p>
                  {whatsappReady ? (
                    <>
                      <p className="text-xs" style={{ color: '#25D366' }}>WhatsApp service is ready</p>
                      <p className="text-xs text-slate-500">Generating your pairing code...</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500">Step 1: Warming up WhatsApp service...</p>
                      <p className="text-xs text-slate-500">Step 2: Completing security handshake...</p>
                      <p className="text-xs text-slate-500">Step 3: Generating your pairing code...</p>
                      <p className="text-xs" style={{ color: '#FFC107', opacity: 0.8 }}>First request may take up to 30 seconds. Please be patient.</p>
                    </>
                  )}
                </div>
              )}

              {step === 'code' && (
                <div className="glass-card rounded-2xl border p-6 space-y-5 animate-fade-in" style={{ borderColor: 'rgba(37,211,102,0.2)', boxShadow: '0 0 25px rgba(37,211,102,0.08)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(37,211,102,0.15)' }}>
                      <Shield className="h-5 w-5" style={{ color: '#25D366' }} />
                    </div>
                    <h3 className="font-bold text-white text-lg">Your Pairing Code</h3>
                  </div>

                  {/* Auto-polling indicator */}
                  <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.15)' }}>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Listening for WhatsApp connection...</span>
                  </div>

                  <div className="bg-black/30 rounded-xl p-6 text-center space-y-2" style={{ border: '1px solid rgba(0,229,255,0.1)' }}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">Pairing Code</p>
                    <p
                      className="text-4xl font-mono font-bold tracking-[0.3em]"
                      style={{
                        color: '#00E5FF',
                        textShadow: '0 0 20px rgba(0,229,255,0.4), 0 0 40px rgba(108,59,255,0.2)',
                      }}
                    >
                      {pairingCode}
                    </p>
                  </div>
                  <button onClick={copyCode} className="w-full py-2.5 rounded-xl border border-white/12 text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all hover:scale-[1.01] active:scale-[0.99]">
                    {copied ? <CheckCircle2 className="h-4 w-4" style={{ color: '#25D366' }} /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                  <div className="glass-card rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Smartphone className="h-4 w-4" style={{ color: '#00E5FF' }} /> Follow these steps:
                    </p>
                    <ol className="space-y-2 text-sm text-slate-300">
                      {[
                        'Open WhatsApp on your phone',
                        'Go to Settings &gt; Linked Devices',
                        'Tap "Link a Device"',
                        'Tap "Link with phone number"',
                        `Enter this code: ${pairingCode}`,
                      ].map((text, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span
                            className="flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0 mt-0.5"
                            style={{
                              background: 'rgba(0,229,255,0.15)',
                              color: '#00E5FF',
                            }}
                          >{i + 1}</span>
                          <span dangerouslySetInnerHTML={{ __html: text.replace(pairingCode, `<b style="color:#00E5FF">${pairingCode}</b>`) }} />
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'rgba(255,193,7,0.08)', border: '1px solid rgba(255,193,7,0.15)' }}>
                    <p className="text-xs flex items-start gap-2" style={{ color: '#FFC107' }}>
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      After requesting the code, you should see a notification on your WhatsApp. Open it, then enter this pairing code.
                    </p>
                  </div>
                </div>
              )}

              {step === 'waiting' && (
                <div className="glass-card rounded-2xl border p-8 flex flex-col items-center gap-4 animate-fade-in" style={{ borderColor: 'rgba(0,229,255,0.15)' }}>
                  <div className="relative">
                    <Loader2 className="h-14 w-14 animate-spin" style={{ color: '#9C4DFF' }} />
                    <Wifi className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: '#081C3A' }} />
                  </div>
                  <p className="text-sm text-slate-300 text-center">
                    Waiting for WhatsApp to confirm...<br />
                    Enter code <b style={{ color: '#00E5FF' }}>{pairingCode}</b> on your phone.
                  </p>
                  <p className="text-xs text-slate-500">Auto-checking every 3 seconds (attempt {pollCount})</p>
                </div>
              )}

              {step === 'connected' && <ConnectedPanel />}
            </div>
          )}

          {/* ======== QR CODE PANEL ======== */}
          {method === 'qr' && (
            <div className="max-w-md mx-auto space-y-4 animate-fade-in">
              <button onClick={() => { setMethod(null); resetPairing() }} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">&larr;</span> Back to Scanner
              </button>

              <div className="glass-card rounded-2xl p-6 space-y-5" style={{ border: '1px solid rgba(108,59,255,0.15)', boxShadow: '0 0 25px rgba(108,59,255,0.06)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(108,59,255,0.18), rgba(255,193,7,0.1))' }}
                    >
                      <QrCode className="h-6 w-6" style={{ color: '#9C4DFF' }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">QR Code</h3>
                      <p className="text-xs text-slate-400">Scan with WhatsApp</p>
                    </div>
                  </div>
                  <button
                    onClick={generateQR}
                    disabled={qrRefreshing}
                    className="p-2.5 rounded-xl border border-white/12 hover:bg-white/5 transition-all hover:scale-105 active:scale-95"
                  >
                    {qrRefreshing ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#9C4DFF' }} /> : <RefreshCw className="h-4 w-4 text-slate-400" />}
                  </button>
                </div>

                {qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white rounded-xl p-3" style={{ boxShadow: '0 0 20px rgba(108,59,255,0.12)' }}>
                      <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                    </div>
                    {step === 'waiting' && (
                      <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2" style={{ color: '#9C4DFF', background: 'rgba(108,59,255,0.08)', border: '1px solid rgba(108,59,255,0.15)' }}>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Waiting for scan... (attempt {pollCount})</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-12 w-12 animate-spin" style={{ color: '#9C4DFF' }} />
                    <p className="text-sm text-slate-400">Generating QR code...</p>
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
                    <Smartphone className="h-4 w-4" style={{ color: '#9C4DFF' }} /> How to scan:
                  </p>
                  <ol className="space-y-1 text-sm text-slate-300 list-decimal list-inside">
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

          {/* Features Section */}
          {!method && (
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto animate-fade-in">
              <div
                className="glass-card p-5 rounded-xl text-center transition-all duration-300 hover:scale-[1.03] group cursor-default"
                style={{
                  border: '1px solid rgba(0,229,255,0.12)',
                  background: 'linear-gradient(135deg, rgba(0,229,255,0.06), rgba(8,28,58,0.6))',
                  boxShadow: '0 0 15px rgba(0,229,255,0.04)',
                }}
              >
                <div className="transition-transform duration-300 group-hover:scale-110">
                  <Shield className="h-7 w-7 mx-auto mb-2.5" style={{ color: '#00E5FF' }} />
                </div>
                <p className="text-xs font-medium text-slate-300">End-to-End Encrypted</p>
              </div>
              <div
                className="glass-card p-5 rounded-xl text-center transition-all duration-300 hover:scale-[1.03] group cursor-default"
                style={{
                  border: '1px solid rgba(255,193,7,0.12)',
                  background: 'linear-gradient(135deg, rgba(255,193,7,0.06), rgba(8,28,58,0.6))',
                  boxShadow: '0 0 15px rgba(255,193,7,0.04)',
                }}
              >
                <div className="transition-transform duration-300 group-hover:scale-110">
                  <Zap className="h-7 w-7 mx-auto mb-2.5" style={{ color: '#FFC107' }} />
                </div>
                <p className="text-xs font-medium text-slate-300">Instant Session</p>
              </div>
              <div
                className="glass-card p-5 rounded-xl text-center transition-all duration-300 hover:scale-[1.03] group cursor-default"
                style={{
                  border: '1px solid rgba(37,211,102,0.12)',
                  background: 'linear-gradient(135deg, rgba(37,211,102,0.06), rgba(8,28,58,0.6))',
                  boxShadow: '0 0 15px rgba(37,211,102,0.04)',
                }}
              >
                <div className="transition-transform duration-300 group-hover:scale-110">
                  <Wifi className="h-7 w-7 mx-auto mb-2.5" style={{ color: '#25D366' }} />
                </div>
                <p className="text-xs font-medium text-slate-300">Multi-Device</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="text-center pt-6 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 flex-wrap">
              <Image src="/caltex-profile.png" alt="" width={16} height={16} className="rounded-full" />
              <span>CALTEX MD v3.0</span>
              <span className="text-slate-700">|</span>
              <span>Powered by Baileys</span>
              <span className="text-slate-700">|</span>
              <span style={{ color: apiOnline ? '#25D366' : '#ef4444' }}>
                API {apiOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className="text-[10px] text-slate-600">
              &copy; {new Date().getFullYear()} CALTEX MD — Built with &#9760; by Caltex Wayne
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
            opacity: 0.25;
          }
          90% {
            opacity: 0.08;
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

        @keyframes logo-pulse {
          0%, 100% {
            box-shadow: 0 0 25px rgba(0,229,255,0.35), 0 0 50px rgba(108,59,255,0.15);
          }
          50% {
            box-shadow: 0 0 35px rgba(0,229,255,0.55), 0 0 70px rgba(108,59,255,0.25);
          }
        }

        @keyframes logo-glow {
          0%, 100% {
            transform: scale(1);
            opacity: 0.6;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        @keyframes card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes aurora-move {
          0% { transform: translateX(-30%) rotate(0deg); }
          50% { transform: translateX(30%) rotate(5deg); }
          100% { transform: translateX(-30%) rotate(0deg); }
        }

        @keyframes wave-drift {
          0% { transform: translateX(0); }
          50% { transform: translateX(-25%); }
          100% { transform: translateX(0); }
        }

        .animated-bg {
          background: linear-gradient(-45deg, #081C3A, #0D2B52, #123A6F, #1A4D8F, #123A6F, #0D2B52);
          background-size: 600% 600%;
          animation: gradient-shift 30s ease infinite;
        }

        /* Subtle touches of purple and cyan in the gradient */
        .animated-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 20% 30%, rgba(108,59,255,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 70%, rgba(0,229,255,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(108,59,255,0.03) 0%, transparent 60%);
          pointer-events: none;
        }

        .glass-card {
          background: rgba(4,18,42,0.55);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        /* Aurora glow behind Welcome */
        .aurora-glow {
          background:
            radial-gradient(ellipse 80% 50% at 50% 50%, rgba(0,229,255,0.04) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 30% 60%, rgba(108,59,255,0.05) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 70% 40%, rgba(26,77,143,0.06) 0%, transparent 50%);
          animation: aurora-move 15s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out both;
        }

        .animate-logo-pulse {
          animation: logo-pulse 3s ease-in-out infinite;
        }

        .animate-logo-glow {
          animation: logo-glow 4s ease-in-out infinite;
        }

        .animate-card-float {
          animation: card-float 4s ease-in-out infinite;
        }

        /* Wave effects */
        .wave-container {
          height: 120px;
          overflow: hidden;
          z-index: 1;
        }

        .wave-top {
          top: 0;
        }

        .wave-bottom {
          bottom: 0;
        }

        .wave-line {
          position: absolute;
          width: 200%;
          height: 2px;
          border-radius: 50%;
          filter: blur(1px);
        }

        .wave-top .wave-line-1 {
          top: 60px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.08), rgba(108,59,255,0.06), transparent);
          animation: wave-drift 20s ease-in-out infinite;
        }

        .wave-top .wave-line-2 {
          top: 75px;
          background: linear-gradient(90deg, transparent, rgba(108,59,255,0.06), rgba(0,229,255,0.05), transparent);
          animation: wave-drift 25s ease-in-out infinite reverse;
        }

        .wave-bottom .wave-line-1 {
          bottom: 40px;
          background: linear-gradient(90deg, transparent, rgba(0,229,255,0.06), rgba(108,59,255,0.04), transparent);
          animation: wave-drift 22s ease-in-out infinite;
        }

        .wave-bottom .wave-line-2 {
          bottom: 55px;
          background: linear-gradient(90deg, transparent, rgba(108,59,255,0.05), rgba(0,229,255,0.04), transparent);
          animation: wave-drift 28s ease-in-out infinite reverse;
        }

        /* Marquee */
        .marquee-container {
          overflow: hidden;
          width: 100%;
        }

        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 35s linear infinite;
        }

        .marquee-container:hover .marquee-track,
        .marquee-container:active .marquee-track {
          animation-play-state: paused;
        }

        .marquee-item {
          white-space: nowrap;
          padding-right: 0;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
        }

        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Input focus styles */
        input:focus {
          border-color: rgba(0,229,255,0.5) !important;
          box-shadow: 0 0 0 1px rgba(0,229,255,0.2);
        }

        /* Success glow animation */
        @keyframes success-glow {
          0% {
            opacity: 1;
            background: radial-gradient(ellipse at center, rgba(37,211,102,0.15) 0%, rgba(0,229,255,0.08) 30%, transparent 70%);
          }
          50% {
            opacity: 0.6;
            background: radial-gradient(ellipse at center, rgba(0,229,255,0.12) 0%, rgba(108,59,255,0.08) 30%, transparent 70%);
          }
          100% {
            opacity: 0;
            background: radial-gradient(ellipse at center, rgba(108,59,255,0.1) 0%, rgba(255,193,7,0.05) 30%, transparent 70%);
          }
        }

        .success-glow-anim {
          animation: success-glow 2.5s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
