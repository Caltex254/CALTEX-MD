'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FolderOpen, File, Download, Trash2, Upload, HardDrive, ChevronRight, Folder } from 'lucide-react'
import { useState } from 'react'

interface FileEntry {
  name: string
  type: 'file' | 'folder'
  size?: number
  modified?: string
}

const MOCK_TREE: Record<string, FileEntry[]> = {
  '/': [
    { name: 'sessions', type: 'folder' },
    { name: 'media', type: 'folder' },
    { name: 'logs', type: 'folder' },
    { name: 'backups', type: 'folder' },
  ],
  '/sessions': [
    { name: 'default-session.json', type: 'file', size: 15234, modified: '2024-12-01' },
    { name: 'secondary-session.json', type: 'file', size: 8421, modified: '2024-11-28' },
  ],
  '/media': [
    { name: 'images', type: 'folder' },
    { name: 'videos', type: 'folder' },
    { name: 'audio', type: 'folder' },
  ],
  '/logs': [
    { name: 'bot.log', type: 'file', size: 245760, modified: '2024-12-15' },
    { name: 'error.log', type: 'file', size: 12845, modified: '2024-12-14' },
  ],
  '/backups': [
    { name: 'backup-2024-12-15.json', type: 'file', size: 524288, modified: '2024-12-15' },
  ],
}

const STORAGE_USED = 12.5 // MB
const STORAGE_TOTAL = 100 // MB

export function FilesPanel() {
  const [currentPath, setCurrentPath] = useState('/')
  const [selected, setSelected] = useState<string | null>(null)

  const entries = MOCK_TREE[currentPath] || []
  const breadcrumbs = currentPath.split('/').filter(Boolean)

  const navigateTo = (name: string) => {
    if (currentPath === '/') setCurrentPath(`/${name}`)
    else setCurrentPath(`${currentPath}/${name}`)
    setSelected(null)
  }

  const goBack = () => {
    const parts = currentPath.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.length ? `/${parts.join('/')}` : '/')
    setSelected(null)
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Storage */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Storage</span>
            </div>
            <span className="text-sm text-muted-foreground">{STORAGE_USED} MB / {STORAGE_TOTAL} MB</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div className="h-2 bg-primary rounded-full" style={{ width: `${(STORAGE_USED / STORAGE_TOTAL) * 100}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Breadcrumb & Upload */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          <button onClick={() => setCurrentPath('/')} className="text-muted-foreground hover:text-foreground">root</button>
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => setCurrentPath('/' + breadcrumbs.slice(0, i + 1).join('/'))}
                className={i === breadcrumbs.length - 1 ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}
              >
                {b}
              </button>
            </span>
          ))}
        </div>
        <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-1" /> Upload</Button>
      </div>

      {/* File List */}
      <Card>
        <CardContent className="p-0">
          {currentPath !== '/' && (
            <button onClick={goBack} className="flex items-center gap-3 px-4 py-3 w-full text-sm hover:bg-accent border-b">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span>..</span>
            </button>
          )}
          {entries.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">Empty folder</div>
          ) : entries.map((entry) => (
            <button
              key={entry.name}
              onClick={() => entry.type === 'folder' ? navigateTo(entry.name) : setSelected(entry.name)}
              className={`flex items-center gap-3 px-4 py-3 w-full text-sm hover:bg-accent border-b last:border-0 ${selected === entry.name ? 'bg-accent' : ''}`}
            >
              {entry.type === 'folder' ? (
                <Folder className="h-4 w-4 text-yellow-500" />
              ) : (
                <File className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 text-left">{entry.name}</span>
              {entry.size && <span className="text-xs text-muted-foreground">{formatSize(entry.size)}</span>}
              {entry.type === 'file' && (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
