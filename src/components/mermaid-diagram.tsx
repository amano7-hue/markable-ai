'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { RefreshCw, Pencil, X, Check, Download } from 'lucide-react'

/**
 * AIが生成したMermaidコードのよくある問題を自動修正する
 * - 未クォートのノードラベルに括弧/特殊文字が含まれる場合にクォートを付与
 * - 例: A[テキスト (LLMO)] → A["テキスト (LLMO)"]
 */
function sanitizeMermaid(code: string): string {
  // [] 内: クォートなしで括弧・特殊文字を含む場合にクォート付与
  return code.replace(/\[([^"\]]*[()&<>][^"\]]*)\]/g, (_, inner) => `["${inner}"]`)
}

interface Props {
  diagramId: string
  articleId: string
  title: string
  mermaidCode: string
  imageUrl?: string | null
}

export default function MermaidDiagram({ diagramId, articleId, title: initialTitle, mermaidCode: initialCode, imageUrl: initialImageUrl }: Props) {
  const uid = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [code, setCode] = useState(initialCode)
  const [title, setTitle] = useState(initialTitle)
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? null)
  const [showMermaid, setShowMermaid] = useState(!initialImageUrl)
  const [editing, setEditing] = useState(false)
  const [editCode, setEditCode] = useState(initialCode)
  const [editTitle, setEditTitle] = useState(initialTitle)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!showMermaid || !containerRef.current) return
    setError(null)
    import('mermaid').then((mod) => {
      const mermaid = mod.default
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          // Primary colors
          primaryColor: '#3b82f6',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#1d4ed8',
          // Secondary
          secondaryColor: '#eff6ff',
          secondaryTextColor: '#1e40af',
          secondaryBorderColor: '#93c5fd',
          // Tertiary
          tertiaryColor: '#f0f9ff',
          tertiaryTextColor: '#0369a1',
          tertiaryBorderColor: '#7dd3fc',
          // Backgrounds
          background: '#ffffff',
          mainBkg: '#3b82f6',
          nodeBorder: '#1d4ed8',
          clusterBkg: '#eff6ff',
          clusterBorder: '#93c5fd',
          // Text & edges
          lineColor: '#64748b',
          titleColor: '#1e3a5f',
          edgeLabelBackground: '#f0f9ff',
          // Fonts
          fontSize: '14px',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          // Note boxes
          noteBkgColor: '#fef9c3',
          noteTextColor: '#713f12',
          noteBorderColor: '#fde047',
          // Sequence diagrams
          activationBkgColor: '#dbeafe',
          activationBorderColor: '#3b82f6',
          labelBoxBkgColor: '#eff6ff',
          labelBoxBorderColor: '#93c5fd',
          labelTextColor: '#1e40af',
          loopTextColor: '#1e40af',
          signalColor: '#1d4ed8',
          signalTextColor: '#1e3a5f',
        },
      })
      const id = `mermaid-${uid.replace(/:/g, '')}`
      mermaid.render(id, sanitizeMermaid(code)).then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg
      }).catch((e: unknown) => {
        setError(String(e))
      })
    })
  }, [code, uid, showMermaid])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/seo/articles/${articleId}/diagrams/${diagramId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mermaidCode: editCode, title: editTitle }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('保存に失敗しました'); return }
    setCode(editCode)
    setTitle(editTitle)
    setEditing(false)
    toast.success('図解を保存しました')
  }

  async function handleDownload(format: 'png' | 'jpeg') {
    // imageUrl がある場合はそちらを直接ダウンロード
    if (imageUrl && !showMermaid) {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      return
    }

    // SVG → Canvas → PNG/JPEG
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) { toast.error('図解が描画されていません'); return }

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    const img = new Image()
    img.onload = () => {
      const scale = 2 // Retina対応
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * scale || svgEl.clientWidth * scale
      canvas.height = img.naturalHeight * scale || svgEl.clientHeight * scale
      const ctx = canvas.getContext('2d')!
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const dataUrl = canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${title}.${format}`
      a.click()
    }
    img.onerror = () => { URL.revokeObjectURL(url); toast.error('ダウンロードに失敗しました') }
    img.src = url
  }

  async function handleRegenerate() {
    setRegenerating(true)
    const res = await fetch(`/api/seo/articles/${articleId}/diagrams/${diagramId}/regenerate`, { method: 'POST' })
    setRegenerating(false)
    if (!res.ok) { toast.error('再生成に失敗しました'); return }
    const d = await res.json()
    setCode(d.mermaidCode)
    setTitle(d.title)
    if (d.imageUrl) { setImageUrl(d.imageUrl); setShowMermaid(false) }
    toast.success('図解を再生成しました')
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">📊 {title}</span>
        <div className="flex items-center gap-1">
          <div className="relative group">
            <Button variant="ghost" size="sm" disabled={editing || regenerating || !!error}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <div className="absolute right-0 top-full z-10 hidden group-hover:flex flex-col min-w-20 rounded border border-border bg-card shadow-md py-1 text-xs">
              <button
                onClick={() => handleDownload('png')}
                className="px-3 py-1.5 text-left hover:bg-accent transition-colors"
              >PNG</button>
              <button
                onClick={() => handleDownload('jpeg')}
                className="px-3 py-1.5 text-left hover:bg-accent transition-colors"
              >JPEG</button>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditCode(code); setEditTitle(title) }} disabled={editing || regenerating}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={regenerating || editing}>
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="p-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">キャプション</Label>
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mermaidコード</Label>
            <Textarea
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={saving} onClick={handleSave}><Check className="mr-1 h-3.5 w-3.5" />保存</Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}><X className="mr-1 h-3.5 w-3.5" />キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="p-3">
          {imageUrl && !showMermaid ? (
            <>
              <img src={imageUrl} alt={title} className="w-full rounded-md object-contain max-h-72 shadow-sm" />
              <button onClick={() => setShowMermaid(true)} className="mt-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline block mx-auto transition-colors">フロー図で確認</button>
            </>
          ) : (
            <>
              {error ? (
                <p className="text-xs text-destructive">描画エラー: {error}</p>
              ) : (
                <div
                  ref={containerRef}
                  className="flex justify-center overflow-x-auto rounded-md bg-white p-4 shadow-sm [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:drop-shadow-sm"
                />
              )}
              {imageUrl && <button onClick={() => setShowMermaid(false)} className="mt-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline block mx-auto transition-colors">画像で確認</button>}
            </>
          )}
          <p className="mt-2 text-center text-xs font-medium text-muted-foreground">{title}</p>
        </div>
      )}
    </div>
  )
}
