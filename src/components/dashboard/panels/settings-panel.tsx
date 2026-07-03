'use client'

import { useDashboardStore } from '@/store/dashboard-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Save, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

export function SettingsPanel() {
  const { token } = useDashboardStore()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchSettings() }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) {
        const map: Record<string, string> = {}
        ;(data.data.settings || []).forEach((s: any) => { map[s.key] = s.value })
        setSettings(map)
      }
    } catch {}
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({ key, value }))
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings: updates }),
      })
    } catch {} finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Settings</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSettings}><RotateCcw className="h-4 w-4 mr-1" /> Reset</Button>
          <Button size="sm" onClick={saveSettings} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="bot">Bot</TabsTrigger>
          <TabsTrigger value="anti">Anti-Features</TabsTrigger>
          <TabsTrigger value="auto">Auto</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div><Label>Bot Prefix</Label><Input value={settings['prefix'] || '!'} onChange={(e) => updateSetting('prefix', e.target.value)} /></div>
              <div><Label>Bot Name</Label><Input value={settings['botName'] || 'CALTEX MD'} onChange={(e) => updateSetting('botName', e.target.value)} /></div>
              <div><Label>Owner Number</Label><Input value={settings['ownerNumber'] || ''} onChange={(e) => updateSetting('ownerNumber', e.target.value)} placeholder="e.g. 1234567890" /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bot" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between"><Label>Read Messages</Label><Switch checked={settings['readMessages'] === 'true'} onCheckedChange={(v) => updateSetting('readMessages', String(v))} /></div>
              <div className="flex items-center justify-between"><Label>Auto Status View</Label><Switch checked={settings['autoStatusView'] === 'true'} onCheckedChange={(v) => updateSetting('autoStatusView', String(v))} /></div>
              <div className="flex items-center justify-between"><Label>Always Online</Label><Switch checked={settings['alwaysOnline'] === 'true'} onCheckedChange={(v) => updateSetting('alwaysOnline', String(v))} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anti" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {['antiLink', 'antiBadword', 'antiSpam', 'antiDelete', 'antiViewOnce', 'antiTag', 'antiCall'].map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="capitalize">{key.replace('anti', 'Anti-')}</Label>
                  <Switch checked={settings[key] === 'true'} onCheckedChange={(v) => updateSetting(key, String(v))} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auto" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between"><Label>Auto React</Label><Switch checked={settings['autoReact'] === 'true'} onCheckedChange={(v) => updateSetting('autoReact', String(v))} /></div>
              <div className="flex items-center justify-between"><Label>Auto Typing</Label><Switch checked={settings['autoTyping'] === 'true'} onCheckedChange={(v) => updateSetting('autoTyping', String(v))} /></div>
              <div className="flex items-center justify-between"><Label>Auto Recording</Label><Switch checked={settings['autoRecording'] === 'true'} onCheckedChange={(v) => updateSetting('autoRecording', String(v))} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div><Label>Welcome Message</Label><Textarea value={settings['welcomeMessage'] || ''} onChange={(e) => updateSetting('welcomeMessage', e.target.value)} rows={3} placeholder="Welcome to the group!" /></div>
              <div><Label>Goodbye Message</Label><Textarea value={settings['goodbyeMessage'] || ''} onChange={(e) => updateSetting('goodbyeMessage', e.target.value)} rows={3} placeholder="Goodbye!" /></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
