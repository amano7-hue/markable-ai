'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, ChevronRight, ChevronLeft, Check, Loader2, Layers } from 'lucide-react'

interface IcpRule {
  type: string
  pattern: string
  score: number
  description: string
}

interface IcpRules {
  rules: IcpRule[]
  maxScore: number
  summary: string
}

const STEPS = [
  {
    key: 'industries',
    label: '対象業界',
    placeholder: '例: SaaS、クラウドサービス、製造業、金融・保険',
    hint: 'ターゲットとする業界・業種を入力してください',
  },
  {
    key: 'companySizes',
    label: '企業規模（従業員数）',
    placeholder: '例: 従業員50〜500人のミドルマーケット企業',
    hint: '理想的な顧客の従業員数を入力してください',
  },
  {
    key: 'annualRevenues',
    label: '企業の売上高',
    placeholder: '例: 年商1億〜10億円、売上10億〜100億円規模',
    hint: 'ターゲット企業の売上高の目安を入力してください',
  },
  {
    key: 'jobTitles',
    label: '意思決定者の役職',
    placeholder: '例: CTO、マーケティング部長、VP of Sales、事業部長',
    hint: '購買の意思決定に関わる主な役職を入力してください',
  },
  {
    key: 'otherCriteria',
    label: 'その他の重要条件（任意）',
    placeholder: '例: DX推進に積極的、予算決裁権がある、競合他社を使っていない',
    hint: '上記以外にICPの特徴として重要な条件があれば入力してください',
  },
]

type Phase = 'quiz' | 'rules' | 'done'

export function IcpSetupDialog({ onComplete }: { onComplete?: () => void }) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('quiz')
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({
    industries: '',
    companySizes: '',
    annualRevenues: '',
    jobTitles: '',
    otherCriteria: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IcpRules | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rescoring, setRescoring] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedSegments, setGeneratedSegments] = useState<{ created: string[]; skipped: string[] } | null>(null)

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isFirst = step === 0

  function handleChange(value: string) {
    setAnswers((prev) => ({ ...prev, [currentStep.key]: value }))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nurturing/icp-config/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'エラーが発生しました')
      setResult(data.rules as IcpRules)
      setPhase('rules')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  async function handleRescore() {
    setRescoring(true)
    try {
      await fetch('/api/nurturing/icp-config/rescore', { method: 'POST' })
      setPhase('done')
    } finally {
      setRescoring(false)
    }
  }

  async function handleGenerateSegments() {
    setGenerating(true)
    try {
      const res = await fetch('/api/nurturing/icp-config/generate-segments', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'セグメント生成に失敗しました')
      setGeneratedSegments(data.data as { created: string[]; skipped: string[] })
      onComplete?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'セグメント生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setPhase('quiz')
    setStep(0)
    setResult(null)
    setError(null)
    setGeneratedSegments(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground">
        <Sparkles className="h-4 w-4" />
        ICPスコアを設定
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AIによるICPスコア設定</DialogTitle>
          <DialogDescription>
            いくつかの質問に答えると、AIがあなたのビジネスに最適なスコアリングルールを自動生成します
          </DialogDescription>
        </DialogHeader>

        {/* ── フェーズ1: クイズ ── */}
        {phase === 'quiz' && (
          <div className="space-y-5">
            {/* ステップインジケーター */}
            <div className="flex items-center gap-1">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={`h-2 w-2 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
                  {i < STEPS.length - 1 && (
                    <div className={`h-px w-6 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">{currentStep.label}</Label>
              <p className="text-sm text-muted-foreground">{currentStep.hint}</p>
              <Textarea
                value={answers[currentStep.key]}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={currentStep.placeholder}
                rows={3}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={isFirst}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                戻る
              </Button>

              {isLast ? (
                <Button onClick={handleGenerate} disabled={loading}>
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AIが分析中...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" />ルールを生成</>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!answers[currentStep.key].trim() && currentStep.key !== 'otherCriteria'}
                >
                  次へ
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── フェーズ2: ルール確認 ── */}
        {phase === 'rules' && result && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Check className="h-4 w-4 text-green-600" />
                ICPスコアリングルールを生成しました
              </div>
              <p className="text-sm text-muted-foreground">{result.summary}</p>
              <div className="space-y-2">
                {result.rules.map((rule, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <span className="inline-block rounded px-1.5 py-0.5 text-xs font-mono bg-background border mr-2">
                        {rule.type === 'jobTitle' ? '役職'
                          : rule.type === 'employeeCount' ? '従業員数'
                          : '売上高'}
                      </span>
                      {rule.description}
                    </div>
                    <span className="shrink-0 font-semibold text-primary">+{rule.score}点</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              このルールを適用すると、既存の全リードのICPスコアが再計算されます。
            </p>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setPhase('quiz')}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                やり直す
              </Button>
              <Button onClick={handleRescore} disabled={rescoring}>
                {rescoring ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />再スコアリング中...</>
                ) : (
                  '適用してスコアを更新'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ── フェーズ3: 完了 & セグメント生成 ── */}
        {phase === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-300/60 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-950/30 p-4 space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                ICPスコアの更新が完了しました
              </div>
              <p className="text-xs text-muted-foreground">全リードのスコアが新しいルールで再計算されました</p>
            </div>

            {generatedSegments ? (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p className="text-sm font-medium">セグメントを作成しました</p>
                {generatedSegments.created.length > 0 && (
                  <ul className="space-y-1">
                    {generatedSegments.created.map((name) => (
                      <li key={name} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
                {generatedSegments.skipped.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    スキップ（同名が存在）: {generatedSegments.skipped.join('、')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">ICPスコアに基づいてセグメントを自動生成しますか？</p>
                <p className="text-xs text-muted-foreground">
                  高スコア・中スコア・育成対象など、ICP設定に合ったセグメントを自動で作成します。
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={handleClose}>
                {generatedSegments ? '閉じる' : 'スキップ'}
              </Button>
              {!generatedSegments && (
                <Button onClick={handleGenerateSegments} disabled={generating}>
                  {generating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</>
                  ) : (
                    <><Layers className="h-4 w-4 mr-2" />セグメントを自動生成</>
                  )}
                </Button>
              )}
              {generatedSegments && (
                <Button onClick={handleClose}>完了</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
