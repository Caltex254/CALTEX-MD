'use client'

import { create } from 'zustand'

interface DashboardState {
  // Auth
  token: string | null
  isAuthenticated: boolean

  // Connection
  botStatus: 'connected' | 'disconnected' | 'connecting' | 'qr'
  qrCode: string | null
  connectedDevices: number

  // Stats
  stats: {
    totalMessages: number
    totalCommands: number
    totalUsers: number
    totalGroups: number
    messagesToday: number
    commandsToday: number
  }

  // Logs
  logs: Array<{ id: string; level: string; source: string; message: string; timestamp: string }>

  // Sessions
  sessions: Array<{ id: string; sessionId: string; status: string; phoneNumber?: string; lastActiveAt?: string }>

  // Plugins
  plugins: Array<{ id: string; name: string; enabled: boolean; version: string; description?: string }>

  // Sidebar
  sidebarOpen: boolean
  activePanel: string

  // Theme
  darkMode: boolean

  // Loading states
  loading: boolean

  // Auth actions
  setToken: (token: string | null) => void
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void

  // Actions
  setBotStatus: (status: any) => void
  setQrCode: (qr: string | null) => void
  setStats: (stats: any) => void
  addLog: (log: any) => void
  setLogs: (logs: any[]) => void
  setSessions: (sessions: any[]) => void
  setPlugins: (plugins: any[]) => void
  toggleSidebar: () => void
  setActivePanel: (panel: string) => void
  toggleDarkMode: () => void
  setLoading: (loading: boolean) => void
  fetchBotStatus: () => Promise<void>
  fetchStats: () => Promise<void>
  fetchLogs: () => Promise<void>
  fetchSessions: () => Promise<void>
  fetchPlugins: () => Promise<void>
}

const getAuthHeaders = (token: string | null) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
})

export const useDashboardStore = create<DashboardState>((set, get) => ({
  // Auth
  token: typeof window !== 'undefined' ? localStorage.getItem('caltex_token') : null,
  isAuthenticated: false,

  // Connection
  botStatus: 'disconnected',
  qrCode: null,
  connectedDevices: 0,

  // Stats
  stats: {
    totalMessages: 0,
    totalCommands: 0,
    totalUsers: 0,
    totalGroups: 0,
    messagesToday: 0,
    commandsToday: 0,
  },

  // Logs
  logs: [],

  // Sessions
  sessions: [],

  // Plugins
  plugins: [],

  // Sidebar
  sidebarOpen: true,
  activePanel: 'overview',

  // Theme
  darkMode: false,

  // Loading
  loading: false,

  // Auth actions
  setToken: (token) => {
    if (token) {
      localStorage.setItem('caltex_token', token)
    } else {
      localStorage.removeItem('caltex_token')
    }
    set({ token, isAuthenticated: !!token })
  },

  login: async (username, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (data.success) {
        get().setToken(data.data.token)
        return true
      }
      return false
    } catch {
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('caltex_token')
    set({ token: null, isAuthenticated: false })
  },

  // Actions
  setBotStatus: (status) => set({ botStatus: status }),
  setQrCode: (qr) => set({ qrCode: qr }),
  setStats: (stats) => set({ stats }),
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs].slice(0, 500) })),
  setLogs: (logs) => set({ logs }),
  setSessions: (sessions) => set({ sessions }),
  setPlugins: (plugins) => set({ plugins }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActivePanel: (panel) => set({ activePanel: panel }),
  toggleDarkMode: () => set((state) => {
    const newMode = !state.darkMode
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', newMode)
    }
    return { darkMode: newMode }
  }),
  setLoading: (loading) => set({ loading }),

  fetchBotStatus: async () => {
    try {
      const { token } = get()
      const res = await fetch('/api/bot/status', { headers: getAuthHeaders(token) })
      const data = await res.json()
      if (data.success) {
        set({
          botStatus: data.data.status || 'disconnected',
          connectedDevices: data.data.totalSessions || 0,
        })
      }
    } catch {}
  },

  fetchStats: async () => {
    try {
      const { token } = get()
      const res = await fetch('/api/stats', { headers: getAuthHeaders(token) })
      const data = await res.json()
      if (data.success) {
        set({
          stats: {
            totalMessages: (data.data.summary?.totalMessagesSent || 0) + (data.data.summary?.totalMessagesReceived || 0),
            totalCommands: data.data.summary?.totalCommands || 0,
            totalUsers: data.data.summary?.totalUsers || 0,
            totalGroups: data.data.summary?.totalGroups || 0,
            messagesToday: 0,
            commandsToday: 0,
          },
        })
      }
    } catch {}
  },

  fetchLogs: async () => {
    try {
      const { token } = get()
      const res = await fetch('/api/logs?limit=100', { headers: getAuthHeaders(token) })
      const data = await res.json()
      if (data.success) {
        set({
          logs: (data.data.logs || []).map((l: any) => ({
            id: l.id,
            level: l.level,
            source: l.source || 'system',
            message: l.message,
            timestamp: l.createdAt,
          })),
        })
      }
    } catch {}
  },

  fetchSessions: async () => {
    try {
      const { token } = get()
      const res = await fetch('/api/sessions', { headers: getAuthHeaders(token) })
      const data = await res.json()
      if (data.success) {
        set({
          sessions: (data.data.sessions || []).map((s: any) => ({
            id: s.id,
            sessionId: s.sessionId,
            status: s.status,
            phoneNumber: s.phoneNumber,
            lastActiveAt: s.lastActiveAt,
          })),
        })
      }
    } catch {}
  },

  fetchPlugins: async () => {
    try {
      const { token } = get()
      const res = await fetch('/api/plugins', { headers: getAuthHeaders(token) })
      const data = await res.json()
      if (data.success) {
        set({
          plugins: (data.data.plugins || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            enabled: p.isEnabled,
            version: p.version,
            description: p.description,
          })),
        })
      }
    } catch {}
  },
}))
