'use client'

import { useEffect, useId, useRef, useState, useCallback } from 'react'
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

interface BrandColors {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
}

interface Props {
  diagramId: string
  articleId: string
  title: string
  mermaidCode: string
  imageUrl?: string | null
  brandColors?: BrandColors | null
}

export default function MermaidDiagram({ diagramId, articleId, title: initialTitle, mermaidCode: initialCode, imageUrl: initialImageUrl, brandColors }: Props) {
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
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [showRegenPrompt, setShowRegenPrompt] = useState(false)
  const [regenPrompt, setRegenPrompt] = useState('')

  useEffect(() => {
    if (!showMermaid || !containerRef.current) return
    setError(null)
    import('mermaid').then((mod) => {
      const mermaid = mod.default
      // ブランドカラーがあれば適用、なければデフォルトのIndigoテーマ
      const primary = brandColors?.primary ?? '#4f46e5'
      const secondary = brandColors?.secondary ?? '#f8fafc'
      const accent = brandColors?.accent ?? '#eef2ff'
      const bg = brandColors?.background ?? '#f8fafc'
      const textColor = brandColors?.text ?? '#1e293b'

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
          primaryColor: primary,
          primaryTextColor: '#ffffff',
          primaryBorderColor: primary,
          secondaryColor: secondary,
          secondaryTextColor: textColor,
          secondaryBorderColor: secondary,
          tertiaryColor: accent,
          tertiaryTextColor: textColor,
          tertiaryBorderColor: accent,
          background: bg,
          mainBkg: primary,
          nodeBorder: primary,
          clusterBkg: bg,
          clusterBorder: secondary,
          lineColor: secondary,
          titleColor: textColor,
          edgeLabelBackground: bg,
          fontSize: '15px',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          noteBkgColor: accent,
          noteTextColor: textColor,
          noteBorderColor: primary,
          activationBkgColor: accent,
          activationBorderColor: primary,
          labelBoxBkgColor: bg,
          labelBoxBorderColor: secondary,
          labelTextColor: textColor,
          loopTextColor: '#334155',
          signalColor: '#4f46e5',
          signalTextColor: '#1e293b',
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

  const handleDownload = useCallback(async (format: 'png' | 'jpeg') => {
    setShowDownloadMenu(false)

    // imageUrl がある場合はそちらを直接ダウンロード
    if (imageUrl && !showMermaid) {
      try {
        const res = await fetch(`/api/private-blob?url=${encodeURIComponent(imageUrl)}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${title}.${format}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch {
        toast.error('ダウンロードに失敗しました')
      }
      return
    }

    // SVG → Canvas → PNG/JPEG
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) { toast.error('図解が描画されていません'); return }

    // SVGに明示的なサイズを付与してからシリアライズ
    const bbox = svgEl.getBoundingClientRect()
    const w = Math.round(bbox.width) || 800
    const h = Math.round(bbox.height) || 600

    const cloned = svgEl.cloneNode(true) as SVGSVGElement
    cloned.setAttribute('width', String(w))
    cloned.setAttribute('height', String(h))
    cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    const svgData = new XMLSerializer().serializeToString(cloned)
    // base64エンコードしてdata URIに変換（blob URLはCORSで描画失敗する場合がある）
    const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`

    const scale = 2
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')!

    const img = new Image()
    img.onload = () => {
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0, w, h)

      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'
      const dataUrl = canvas.toDataURL(mimeType, 0.95)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${title}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    img.onerror = () => toast.error('ダウンロードに失敗しました')
    img.src = svgBase64
  }, [imageUrl, showMermaid, title])

  async function handleRegenerate(customPrompt?: string) {
    setRegenerating(true)
    setShowRegenPrompt(false)
    const res = await fetch(`/api/seo/articles/${articleId}/diagrams/${diagramId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPrompt: customPrompt?.trim() || undefined }),
    })
    setRegenerating(false)
    if (!res.ok) { toast.error('再生成に失敗しました'); return }
    const d = await res.json()
    setCode(d.mermaidCode)
    setTitle(d.title)
    setRegenPrompt('')
    if (d.imageUrl) { setImageUrl(d.imageUrl); setShowMermaid(false) }
    toast.success('図解を再生成しました')
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">📊 {title}</span>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Button
              variant="ghost" size="sm"
              disabled={editing || regenerating || !!error}
              onClick={() => setShowDownloadMenu((v) => !v)}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            {showDownloadMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                <div className="absolute right-0 top-full z-20 flex flex-col min-w-20 rounded border border-border bg-card shadow-md py-1 text-xs">
                  <button
                    onClick={() => handleDownload('png')}
                    className="px-3 py-1.5 text-left hover:bg-accent transition-colors"
                  >PNG</button>
                  <button
                    onClick={() => handleDownload('jpeg')}
                    className="px-3 py-1.5 text-left hover:bg-accent transition-colors"
                  >JPEG</button>
                </div>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditCode(code); setEditTitle(title) }} disabled={editing || regenerating}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowRegenPrompt((v) => !v)} disabled={regenerating || editing}>
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {showRegenPrompt && !editing && (
        <div className="border-b border-border bg-muted/20 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">追加指示（任意）</p>
            <button onClick={() => setShowRegenPrompt(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={regenPrompt}
            onChange={(e) => setRegenPrompt(e.target.value)}
            placeholder="例: フローチャートをシーケンス図に変更して / もっとシンプルにして"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setShowRegenPrompt(false)} disabled={regenerating} className="h-7 text-xs">キャンセル</Button>
            <Button size="sm" onClick={() => handleRegenerate(regenPrompt)} disabled={regenerating} className="h-7 text-xs gap-1">
              <RefreshCw className={`h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? '生成中...' : '再生成'}
            </Button>
          </div>
        </div>
      )}

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
              <img src={`/api/private-blob?url=${encodeURIComponent(imageUrl)}`} alt={title} className="w-full rounded-md object-contain max-h-72 shadow-sm" />
              <button onClick={() => setShowMermaid(true)} className="mt-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline block mx-auto transition-colors">フロー図で確認</button>
            </>
          ) : (
            <>
              {error ? (
                <p className="text-xs text-destructive">描画エラー: {error}</p>
              ) : (
                <div
                  ref={containerRef}
                  className="flex justify-center overflow-x-auto rounded-lg bg-slate-50 p-6 ring-1 ring-slate-200/60 [&>svg]:max-w-full [&>svg]:h-auto"
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
