import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/client'
import type { GenerateEmailInput } from './schemas'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })

export function parseEmailDraftOutput(
  rawText: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const lines = rawText.split('\n')
  const subjectLine = lines.find((l) => l.startsWith('件名:'))
  const subject = subjectLine ? subjectLine.replace('件名:', '').trim() : fallbackSubject
  const separatorIdx = lines.indexOf('---')
  const body = separatorIdx >= 0 ? lines.slice(separatorIdx + 1).join('\n').trim() : rawText.trim()
  return { subject, body }
}

const GOAL_LABELS: Record<string, string> = {
  '初回接触': '初回接触メール（認知・興味喚起）',
  '商談化促進': '商談化促進メール（デモ・提案の打診）',
  '失注後フォロー': '失注後フォローメール（関係継続）',
  '事例紹介': '成功事例紹介メール',
  '機能アップデート': '新機能・アップデートのお知らせ',
}

export async function generateEmailDraft(tenantId: string, input: GenerateEmailInput) {
  const segment = await prisma.nurtureSegment.findFirst({
    where: { id: input.segmentId, tenantId },
    include: {
      leads: {
        take: 3,
        include: { lead: { select: { jobTitle: true, lifecycle: true, emailOpenCount: true, emailClickCount: true, lastEmailOpenAt: true } } },
      },
    },
  })
  if (!segment) throw new Error('Segment not found')

  const leadContext = segment.leads
    .map((ls) => {
      const l = ls.lead
      const daysSinceOpen = l.lastEmailOpenAt
        ? Math.floor((Date.now() - new Date(l.lastEmailOpenAt).getTime()) / 86_400_000)
        : null
      return [
        `- 役職: ${l.jobTitle ?? '不明'}, ライフサイクル: ${l.lifecycle ?? '不明'}`,
        `  開封数: ${l.emailOpenCount ?? 0}回, クリック数: ${l.emailClickCount ?? 0}回`,
        daysSinceOpen !== null ? `  最終開封: ${daysSinceOpen}日前` : '  開封履歴なし',
      ].join('\n')
    })
    .join('\n')

  const goalLabel = GOAL_LABELS[input.goal] ?? input.goal

  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `BtoBマーケティング向けの${goalLabel}を作成してください。

セグメント名: "${segment.name}"
${segment.description ? `セグメント説明: ${segment.description}` : ''}

代表的なリード属性（開封・クリック履歴を参考に内容を調整してください）:
${leadContext || '- 情報なし'}

以下の形式で出力してください:
件名: [メール件名]
---
[メール本文（300〜400文字）]`,
  })

  const rawText = result.text ?? ''
  const { subject, body } = parseEmailDraftOutput(rawText, `${goalLabel} - ${segment.name}`)

  const draft = await prisma.nurtureEmailDraft.create({
    data: { tenantId, segmentId: input.segmentId, subject, body },
  })

  await prisma.approvalItem.create({
    data: {
      tenantId,
      module: 'nurturing',
      type: 'nurturing_email_draft',
      payload: {
        draftId: draft.id,
        segmentId: input.segmentId,
        segmentName: segment.name,
        goal: input.goal,
        subject,
        body,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { draftId: draft.id }
}

/**
 * A/B テスト用: 2バリアントのメールを1つの ApprovalItem にまとめて生成する
 */
export async function generateEmailVariants(tenantId: string, input: GenerateEmailInput) {
  const segment = await prisma.nurtureSegment.findFirst({
    where: { id: input.segmentId, tenantId },
    include: {
      leads: {
        take: 3,
        include: { lead: { select: { jobTitle: true, lifecycle: true, emailOpenCount: true, emailClickCount: true, lastEmailOpenAt: true } } },
      },
    },
  })
  if (!segment) throw new Error('Segment not found')

  const leadContext = segment.leads
    .map((ls) => {
      const l = ls.lead
      const daysSinceOpen = l.lastEmailOpenAt
        ? Math.floor((Date.now() - new Date(l.lastEmailOpenAt).getTime()) / 86_400_000)
        : null
      return [
        `- 役職: ${l.jobTitle ?? '不明'}, ライフサイクル: ${l.lifecycle ?? '不明'}`,
        `  開封数: ${l.emailOpenCount ?? 0}回, クリック数: ${l.emailClickCount ?? 0}回`,
        daysSinceOpen !== null ? `  最終開封: ${daysSinceOpen}日前` : '  開封履歴なし',
      ].join('\n')
    })
    .join('\n')

  const goalLabel = GOAL_LABELS[input.goal] ?? input.goal

  const [resultA, resultB] = await Promise.all([
    genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `BtoBマーケティング向けの${goalLabel}を作成してください（Variant A: 直接的で簡潔なスタイル）。

セグメント名: "${segment.name}"
${segment.description ? `セグメント説明: ${segment.description}` : ''}
代表的なリード属性:
${leadContext || '- 情報なし'}

件名は短く直接的に。本文は300〜400文字で要点を端的に伝えてください。

以下の形式で出力してください:
件名: [メール件名]
---
[メール本文]`,
    }),
    genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `BtoBマーケティング向けの${goalLabel}を作成してください（Variant B: 質問形式・感情訴求スタイル）。

セグメント名: "${segment.name}"
${segment.description ? `セグメント説明: ${segment.description}` : ''}
代表的なリード属性:
${leadContext || '- 情報なし'}

件名は質問形式や数字を含む感情訴求型に。本文は読み手の課題・感情に共感しながら誘導してください（300〜400文字）。

以下の形式で出力してください:
件名: [メール件名]
---
[メール本文]`,
    }),
  ])

  const variantA = parseEmailDraftOutput(resultA.text ?? '', `[A] ${goalLabel} - ${segment.name}`)
  const variantB = parseEmailDraftOutput(resultB.text ?? '', `[B] ${goalLabel} - ${segment.name}`)

  const draft = await prisma.nurtureEmailDraft.create({
    data: { tenantId, segmentId: input.segmentId, subject: variantA.subject, body: variantA.body },
  })

  await prisma.approvalItem.create({
    data: {
      tenantId,
      module: 'nurturing',
      type: 'nurturing_email_draft',
      payload: {
        draftId: draft.id,
        segmentId: input.segmentId,
        segmentName: segment.name,
        goal: input.goal,
        isAbTest: true,
        selectedVariant: 'A',
        subject: variantA.subject,
        body: variantA.body,
        variants: [
          { label: 'A', style: '直接的・簡潔', subject: variantA.subject, body: variantA.body },
          { label: 'B', style: '質問形式・感情訴求', subject: variantB.subject, body: variantB.body },
        ],
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { draftId: draft.id, variants: ['A', 'B'] }
}

const DRAFT_PAGE_SIZE = 20

export async function listDrafts(tenantId: string, status?: string, page = 1, projectId?: string) {
  const where = {
    tenantId,
    ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    ...(projectId ? { projectId } : {}),
  }
  const skip = (page - 1) * DRAFT_PAGE_SIZE
  const [drafts, total] = await Promise.all([
    prisma.nurtureEmailDraft.findMany({
      where,
      include: { segment: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: DRAFT_PAGE_SIZE,
    }),
    prisma.nurtureEmailDraft.count({ where }),
  ])
  return { drafts, total }
}

export async function getDraft(tenantId: string, draftId: string) {
  return prisma.nurtureEmailDraft.findFirst({
    where: { id: draftId, tenantId },
    include: { segment: { select: { name: true } } },
  })
}
