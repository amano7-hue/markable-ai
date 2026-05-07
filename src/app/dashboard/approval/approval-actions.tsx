'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { diffWords } from 'diff'
import { Button } from '@/components/ui/button'
import { Pencil, X, GitCompare, ChevronDown, ChevronUp, FlaskConical, Zap } from 'lucide-react'

type ItemType = 'aeo_suggestion' | 'seo_article_draft' | 'nurturing_email_draft' | string

type EmailVariant = { label: string; style: string; subject: string; body: string }

interface Props {
  itemId: string
  type: ItemType
  payload: Record<string, string> & { isAbTest?: boolean; variants?: EmailVariant[]; selectedVariant?: string }
}

function EditableField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/** ワードレベルの diff を色付きでレンダリング */
function DiffText({ original, edited }: { original: string; edited: string }) {
  const parts = diffWords(original, edited)
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <mark key={i} className="bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200 rounded-sm px-0.5">
              {part.value}
            </mark>
          )
        }
        if (part.removed) {
          return (
            <del key={i} className="bg-red-200/80 text-red-900 dark:bg-red-900/50 dark:text-red-200 rounded-sm px-0.5 no-underline line-through opacity-70">
              {part.value}
            </del>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </p>
  )
}

/** フィールド1件の Before/After 差分表示 */
function DiffField({
  label,
  original,
  edited,
}: {
  label: string
  original: string
  edited: string
}) {
  const unchanged = original === edited
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {unchanged && (
          <span className="text-xs text-muted-foreground opacity-60">（変更なし）</span>
        )}
      </div>
      {unchanged ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words line-clamp-3">
          {original}
        </p>
      ) : (
        <div className="rounded-md border border-border bg-muted/20 p-3">
          <DiffText original={original} edited={edited} />
        </div>
      )}
    </div>
  )
}

/** 差分プレビューパネル */
function DiffPanel({
  type,
  original,
  edits,
}: {
  type: ItemType
  original: Record<string, string>
  edits: Record<string, string>
}) {
  function edited(key: string) {
    return edits[key] ?? original[key] ?? ''
  }

  const hasAnyChange = Object.entries(edits).some(
    ([key, val]) => original[key] !== undefined && original[key] !== val,
  )

  if (!hasAnyChange) {
    return (
      <p className="text-sm text-muted-foreground">まだ変更がありません。</p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-200/80 dark:bg-red-900/50" />
          削除
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200/80 dark:bg-emerald-900/50" />
          追加
        </span>
      </div>

      {type === 'aeo_suggestion' && (
        <DiffField label="改善提案" original={original.suggestion ?? ''} edited={edited('suggestion')} />
      )}

      {type === 'seo_article_draft' && (
        <>
          <DiffField label="タイトル" original={original.title ?? ''} edited={edited('title')} />
          <DiffField label="ブリーフ" original={original.brief ?? ''} edited={edited('brief')} />
          {(original.draft || edits.draft) && (
            <DiffField label="ドラフト" original={original.draft ?? ''} edited={edited('draft')} />
          )}
        </>
      )}

      {type === 'nurturing_email_draft' && (
        <>
          <DiffField label="件名" original={original.subject ?? ''} edited={edited('subject')} />
          <DiffField label="本文" original={original.body ?? ''} edited={edited('body')} />
        </>
      )}
    </div>
  )
}

function AutoExecuteResult({ result }: { result: Record<string, unknown> }) {
  if (result.autoError) {
    return <p className="text-xs text-destructive">自動実行エラー: {String(result.autoError)}</p>
  }
  const llmo = result.llmo as { applied?: boolean } | undefined
  const email = result.email as { sent?: number; skipped?: number } | undefined
  const wp = result.wordpress as { published?: boolean; url?: string } | undefined
  if (!llmo?.applied && !email && !wp?.published) return null
  return (
    <div className="rounded-md border border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 space-y-0.5">
      <p className="flex items-center gap-1 font-medium">
        <Zap className="h-3 w-3" />
        自動実行完了
      </p>
      {llmo?.applied && <p>プロンプトを自動更新しました</p>}
      {email && <p>メール送信: {email.sent ?? 0} 件送信 / {email.skipped ?? 0} 件スキップ</p>}
      {wp?.published && (
        <p>WordPress: <a href={wp.url} target="_blank" rel="noopener noreferrer" className="underline">{wp.url}</a></p>
      )}
    </div>
  )
}

export default function ApprovalActions({ itemId, type, payload }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [autoResult, setAutoResult] = useState<Record<string, unknown> | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [showDiff, setShowDiff] = useState(false)
  // A/B テスト: どちらのバリアントを選択しているか
  const [selectedVariant, setSelectedVariant] = useState<string>(payload.selectedVariant ?? 'A')

  const isAbTest = payload.isAbTest === true && Array.isArray(payload.variants)
  const variants = (payload.variants ?? []) as EmailVariant[]
  const activeVariant = isAbTest ? (variants.find((v) => v.label === selectedVariant) ?? variants[0]) : null

  // A/B テスト時、選択バリアントの subject/body を payload として使う
  const effectivePayload: Record<string, string> = isAbTest && activeVariant
    ? { ...payload as Record<string, string>, subject: activeVariant.subject, body: activeVariant.body }
    : { ...payload as Record<string, string> }

  const hasEdits = Object.keys(edits).some((key) => edits[key] !== effectivePayload[key])

  function field(key: string) {
    return edits[key] ?? effectivePayload[key] ?? ''
  }

  function setField(key: string, value: string) {
    setEdits((prev) => ({ ...prev, [key]: value }))
  }

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    const res = await fetch('/api/approval', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemId,
        action,
        ...(hasEdits ? { edits } : {}),
        // A/B テスト: 選択バリアントを edits として送信（未編集でも subject/body を上書き）
        ...(isAbTest && activeVariant && !hasEdits
          ? { edits: { subject: activeVariant.subject, body: activeVariant.body, selectedVariant } }
          : {}),
      }),
    })
    setLoading(null)
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.success(action === 'approve' ? '承認しました' : '却下しました')
      if (action === 'approve') {
        setAutoResult(data)
        if (data.autoError) toast.error(`自動実行エラー: ${data.autoError}`)
        else if (data.llmo?.applied) toast.success('プロンプトを自動更新しました')
        else if (data.email?.sent > 0) toast.success(`${data.email.sent} 件のメールを送信しました`)
        else if (data.wordpress?.published) toast.success(`WordPress に公開しました: ${data.wordpress.url}`)
      }
      router.refresh()
    } else {
      toast.error('操作に失敗しました')
    }
  }

  return (
    <div className="space-y-3">
      {/* A/B テスト バリアント選択 */}
      {isAbTest && variants.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <FlaskConical className="h-3.5 w-3.5" />
            A/B テスト — 採用するバリアントを選択
          </div>
          <div className="grid grid-cols-2 gap-2">
            {variants.map((v) => (
              <button
                key={v.label}
                type="button"
                onClick={() => {
                  setSelectedVariant(v.label)
                  setEdits({}) // バリアント変更時は編集をリセット
                }}
                className={[
                  'rounded-md border p-2.5 text-left text-xs transition-colors',
                  selectedVariant === v.label
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-accent',
                ].join(' ')}
              >
                <p className="font-semibold">Variant {v.label}</p>
                <p className="text-muted-foreground mt-0.5">{v.style}</p>
                <p className="mt-1.5 font-medium line-clamp-1">{v.subject}</p>
                <p className="text-muted-foreground line-clamp-2 mt-0.5">{v.body}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* インライン編集フォーム */}
      {mode === 'edit' && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          {type === 'aeo_suggestion' && (
            <EditableField
              label="改善提案"
              value={field('suggestion')}
              onChange={(v) => setField('suggestion', v)}
              rows={5}
            />
          )}
          {type === 'seo_article_draft' && (
            <>
              <EditableField
                label="タイトル"
                value={field('title')}
                onChange={(v) => setField('title', v)}
                rows={1}
              />
              <EditableField
                label="ブリーフ"
                value={field('brief')}
                onChange={(v) => setField('brief', v)}
                rows={4}
              />
              {payload.draft && (
                <EditableField
                  label="ドラフト"
                  value={field('draft')}
                  onChange={(v) => setField('draft', v)}
                  rows={8}
                />
              )}
            </>
          )}
          {type === 'nurturing_email_draft' && (
            <>
              <EditableField
                label="件名"
                value={field('subject')}
                onChange={(v) => setField('subject', v)}
                rows={1}
              />
              <EditableField
                label="本文"
                value={field('body')}
                onChange={(v) => setField('body', v)}
                rows={8}
              />
            </>
          )}

          {/* 差分プレビュー */}
          {hasEdits && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDiff((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-primary hover:opacity-80 transition-opacity"
              >
                <GitCompare className="h-3.5 w-3.5" />
                差分を確認
                {showDiff ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
              {showDiff && (
                <div className="mt-3 rounded-lg border border-border bg-background p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    変更内容
                  </p>
                  <DiffPanel type={type} original={effectivePayload} edits={edits} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 自動実行結果 */}
      {autoResult ? <AutoExecuteResult result={autoResult} /> : null}

      {/* アクションボタン行 */}
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={loading !== null} onClick={() => act('approve')}>
          {loading === 'approve' ? '...' : mode === 'edit' && hasEdits ? '編集して承認' : '承認'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={loading !== null}
          onClick={() => act('reject')}
        >
          {loading === 'reject' ? '...' : '却下'}
        </Button>
        {type !== 'string' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setMode((m) => (m === 'edit' ? 'view' : 'edit'))
              setEdits({})
              setShowDiff(false)
            }}
          >
            {mode === 'edit' ? (
              <><X className="mr-1 h-3 w-3" />キャンセル</>
            ) : (
              <><Pencil className="mr-1 h-3 w-3" />編集</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
