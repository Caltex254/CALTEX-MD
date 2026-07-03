'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Save, TestTube, Bot } from 'lucide-react'
import { useEffect, useState } from 'react'

const PROVIDERS = ['openai', 'gemini', 'claude', 'ollama', 'custom']
const MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  gemini: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  claude: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  ollama: ['llama3', 'mistral', 'codellama', 'phi3'],
  custom: [],
}

export function AiPanel() {
  const { token } = useDashboardStore()
  const [provider, setProvider] = useState('openai')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState('4096')
  const [isEnabled, setIsEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => { fetchAiSettings() }, [])

  const fetchAiSettings = async () => {
    try {
      const res = await fetch('/api/ai', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success && data.data) {
        setProvider(data.data.provider || 'openai')
        setApiKey('')
        setModel(data.data.model || '')
        setSystemPrompt(data.data.systemPrompt || '')
        setTemperature([data.data.temperature || 0.7])
        setMaxTokens(String(data.data.maxTokens || 4096))
        setIsEnabled(data.data.isEnabled || false)
      }
    } catch {}
  }

  const saveAiSettings = async () => {
    setSaving(true)
    try {
      await fetch('/api/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider, model, systemPrompt,
          temperature: temperature[0],
          maxTokens: parseInt(maxTokens),
          isEnabled,
          ...(apiKey ? { apiKey } : {}),
        }),
      })
    } catch {} finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/ai', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      alert(data.success ? 'Connection successful!' : 'Connection failed: ' + (data.error || 'Unknown error'))
    } catch {
      alert('Connection failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4" /> AI Configuration</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Enabled</Label>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Model</Label>
              {MODELS[provider]?.length ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {MODELS[provider].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Enter model name" />
              )}
            </div>
          </div>

          <div>
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
          </div>

          <div>
            <Label>System Prompt</Label>
            <Textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} placeholder="You are a helpful WhatsApp bot assistant..." />
          </div>

          <div>
            <Label>Temperature: {temperature[0]}</Label>
            <Slider value={temperature} onValueChange={setTemperature} min={0} max={2} step={0.1} className="mt-2" />
          </div>

          <div>
            <Label>Max Tokens</Label>
            <Input type="number" value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={saveAiSettings} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}><TestTube className="h-4 w-4 mr-1" /> Test Connection</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
