import { z } from 'zod'
import { getAuth } from '@/lib/auth/get-auth'
import { ok, err } from '@/lib/api-response'
import { prisma } from '@/lib/db/client'
import type { ApprovalStatus } from '@/generated/prisma'
import { GoogleGenAI } from '@google/genai'
import { Resend } from 'resend'
import { WordPressClient } from '@/integrations/wordpress/client'

export async function GET(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const url = new URL(req.url)
  const moduleFilter = url.searchParams.get('module') ?? undefined
  const status = (url.searchParams.get('status') ?? undefined) as ApprovalStatus | undefined

  const items = await prisma.approvalItem.findMany({
    where: {
      tenantId: ctx.tenant.id,
      ...(moduleFilter ? { module: moduleFilter } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return ok(items)
}

const PatchSchema = z.object({
  id: z.string(),
  action: z.enum(['approve', 'reject']),
  /** 編集済みペイロードフィールド（インライン編集時のみ） */
  edits: z.record(z.string(), z.string()).optional(),
})

export async function PATCH(req: Request) {
  const ctx = await getAuth()
  if (!ctx) return err('Unauthorized', 401)

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return err(parsed.error.message)

  const { id, edits } = parsed.data
  const status: ApprovalStatus =
    parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED'
  const reviewedAt = new Date()

  const item = await prisma.approvalItem.findFirst({
    where: { id, tenantId: ctx.tenant.id },
  })
  if (!item) return err('Not found', 404)

  const payload = { ...(item.payload as Record<string, unknown>), ...edits }

  await prisma.approvalItem.updateMany({
    where: { id, tenantId: ctx.tenant.id },
    data: { status, reviewedAt, reviewedBy: ctx.user.id, payload },
  })

  // ドメインモデルも同期
  if (item.type === 'nurturing_email_draft' && typeof payload.draftId === 'string') {
    await prisma.nurtureEmailDraft.updateMany({
      where: { id: payload.draftId, tenantId: ctx.tenant.id },
      data: {
        status,
        reviewedAt,
        reviewedBy: ctx.user.id,
        ...(edits?.subject ? { subject: edits.subject } : {}),
        ...(edits?.body ? { body: edits.body } : {}),
      },
    })
  } else if (item.type === 'seo_article_draft' && typeof payload.articleId === 'string') {
    await prisma.seoArticle.updateMany({
      where: { id: payload.articleId, tenantId: ctx.tenant.id },
      data: {
        status,
        reviewedAt,
        reviewedBy: ctx.user.id,
        ...(edits?.title ? { title: edits.title } : {}),
        ...(edits?.brief ? { brief: edits.brief } : {}),
        ...(edits?.draft ? { draft: edits.draft } : {}),
      },
    })
  }

  // ── 承認後の自動実行 ──────────────────────────────────────────
  const autoResult: Record<string, unknown> = {}

  if (status === 'APPROVED') {
    try {
      if (item.type === 'aeo_suggestion') {
        autoResult.llmo = await autoApplyLlmoSuggestion(ctx.tenant.id, payload)
      } else if (item.type === 'nurturing_email_draft') {
        autoResult.email = await autoSendNurturingEmail(ctx.tenant, payload)
      } else if (item.type === 'seo_article_draft') {
        autoResult.wordpress = await autoPublishToWordPress(ctx.tenant, payload)
      }
    } catch (e) {
      // 自動実行が失敗しても承認自体は成功として返す
      autoResult.autoError = e instanceof Error ? e.message : 'Auto-execute failed'
    }
  }

  return ok({ updated: true, ...autoResult })
}

// ── LLMO: プロンプトを提案で書き換え ──────────────────────────────

async function autoApplyLlmoSuggestion(
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<{ applied: boolean; newText?: string }> {
  const promptId = payload.promptId
  const suggestion = payload.suggestion
  if (typeof promptId !== 'string' || typeof suggestion !== 'string') {
    return { applied: false }
  }

  const prompt = await prisma.aeoPrompt.findFirst({
    where: { id: promptId, tenantId },
  })
  if (!prompt) return { applied: false }

  const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! })
  const result = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `以下の改善提案をもとに、元のLLMOプロンプトを書き直してください。
出力はプロンプト文のみ（説明文不要）。

元のプロンプト: ${prompt.text}

改善提案: ${suggestion}`,
  })

  const newText = result.text?.trim() ?? ''
  if (!newText) return { applied: false }

  await prisma.aeoPrompt.update({
    where: { id: promptId },
    data: { text: newText, updatedAt: new Date() },
  })

  return { applied: true, newText }
}

// ── ナーチャリング: Resend でセグメントリードにメール送信 ─────────

async function autoSendNurturingEmail(
  tenant: { id: string; resendFrom: string | null },
  payload: Record<string, unknown>,
): Promise<{ sent: number; skipped: number; error?: string }> {
  const segmentId = payload.segmentId
  const subject = typeof payload.subject === 'string' ? payload.subject : ''
  const emailBody = typeof payload.body === 'string' ? payload.body : ''

  if (!subject || !emailBody) return { sent: 0, skipped: 0, error: '件名または本文が空です' }
  if (!process.env.RESEND_API_KEY) return { sent: 0, skipped: 0, error: 'RESEND_API_KEY が設定されていません' }

  const fromAddress = tenant.resendFrom ?? `noreply@${process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'markable.ai'}`

  const leads = typeof segmentId === 'string'
    ? await prisma.nurtureLead.findMany({
        where: {
          tenantId: tenant.id,
          segments: { some: { segmentId } },
        },
        select: { email: true },
      })
    : []

  if (leads.length === 0) return { sent: 0, skipped: 0, error: 'セグメントにリードがありません' }

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  let skipped = 0

  for (const lead of leads) {
    if (!lead.email) { skipped++; continue }
    try {
      await resend.emails.send({
        from: fromAddress,
        to: lead.email,
        subject,
        html: emailBody.replace(/\n/g, '<br>'),
      })
      sent++
    } catch {
      skipped++
    }
  }

  return { sent, skipped }
}

// ── SEO記事: WordPress に投稿 ────────────────────────────────────

async function autoPublishToWordPress(
  tenant: { id: string; wpUrl: string | null; wpUsername: string | null; wpAppPassword: string | null },
  payload: Record<string, unknown>,
): Promise<{ published: boolean; url?: string; error?: string }> {
  if (!tenant.wpUrl || !tenant.wpUsername || !tenant.wpAppPassword) {
    return { published: false, error: 'WordPress 接続情報が設定されていません。設定ページから接続してください。' }
  }

  const title = typeof payload.title === 'string' ? payload.title : ''
  const content = typeof payload.draft === 'string' ? payload.draft
    : typeof payload.brief === 'string' ? payload.brief
    : ''

  if (!title || !content) return { published: false, error: 'タイトルまたはコンテンツが空です' }

  const wp = new WordPressClient(tenant.wpUrl, tenant.wpUsername, tenant.wpAppPassword)
  const post = await wp.createPost({
    title,
    content,
    excerpt: typeof payload.brief === 'string' ? payload.brief.slice(0, 200) : '',
    status: 'publish',
  })

  return { published: true, url: post.link }
}
