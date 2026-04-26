# Markable AI (マーカブルAI)

BtoB 企業向けのマーケティング自動化 AI。AI 検索対策 (AEO)・SEO・メールナーチャリングを半自動化し、マーケを通じて企業を「売れる状態 (marketable)」にする。人間が承認キューでレビューする Human-in-the-Loop 型の SaaS。

## 技術スタック

- TypeScript (strict mode、any 禁止)
- Next.js 15 (App Router、Server Components 優先)
- Prisma + PostgreSQL (Row-Level Security でテナント分離)
- Inngest (バックグラウンドジョブ)
- Clerk (認証・組織管理)
- shadcn/ui + Tailwind CSS
- Anthropic SDK (コンテンツ生成)
- pnpm (パッケージ管理)

## リポジトリ構成

- `src/app/` — Next.js ルーティング。API Routes は `app/api/`
- `src/modules/` — ドメインロジック。モジュール境界を厳守:
  - `aeo/` — AI 検索対策。Seranking AI Search API + AIRT が主データ源
  - `seo/` — キーワード分析、コンテンツ生成、テクニカル監査
  - `nurturing/` — セグメント、メール下書き、スコアリング
  - `approval/` — 承認キュー (全モジュールの AI 生成物がここに流れる)
- `src/integrations/` — 外部 API クライアント。`ga4/` `gsc/` `seranking/` `hubspot/`
- `src/lib/` — 共通ユーティリティ。`db/` `auth/` `ai/` `tenant/`
- `src/workers/` — Inngest ジョブ定義
- `prisma/schema.prisma` — DB スキーマ (全テーブルに `tenantId` 必須)
- `docs/` — 仕様書。重要な設計判断は `docs/adr/` に ADR として残す

## 絶対に守るルール

- **マルチテナント安全性**: すべての DB クエリに `tenantId` を必ず含める。Prisma の middleware で自動付与を徹底。RLS を二重防御として使う。テナント跨ぎの漏洩は即座に事業が終わる
- **シークレット管理**: API キー・トークン類は `.env` のみ。コードへの直書き・コミット禁止。`git-secrets` で pre-commit フックを通す
- **著作権**: Web から取得したコンテンツをそのまま保存・配信しない。要約・メタデータのみ
- **メール送信**: 本番環境では必ずサンドボックスまたはテストテナント経由で検証。誤送信防止
- **API コスト**: Seranking の leaderboard は 7,500 credits/req と高額。呼び出しは必ずキャッシュ + レート制御

## コーディング規約

- 関数コンポーネント + hooks のみ。クラスコンポーネント禁止
- Server Components をデフォルトに。`"use client"` は必要最小限
- ファイル命名は kebab-case。コンポーネントは PascalCase
- DB 操作は必ず `src/lib/db/` 経由。コンポーネントから直接 Prisma を呼ばない
- 新機能には Playwright または Vitest のテストを必ず追加
- import は絶対パス (`@/modules/aeo/...`)

## よく使うコマンド

- `pnpm dev` — 開発サーバー
- `pnpm build` — 本番ビルド
- `pnpm test` — テスト実行
- `pnpm lint` — ESLint + Prettier
- `pnpm db:migrate` — Prisma migrate dev
- `pnpm db:studio` — Prisma Studio
- `pnpm inngest:dev` — Inngest Dev Server

## セッション運用ルール

- 新しいタスクを始める時は、関連する `docs/modules/*.md` を必ず参照する
- 大きな変更は Plan Mode で先に設計を提示する
- 1セッションで複数モジュールを横断する変更はしない。必要なら分割する
- アーキテクチャレベルの判断を下した時は `docs/adr/` に記録する
- 不明点があれば憶測せず質問する。特にテナント分離と API コストに関わる判断は必ず確認

## ブランド方針

- プロダクト名: **Markable AI** (英語表記) / **マーカブルAI** (日本語表記)
- リポジトリ名: `markeble-ai`
- 語源: Marketing × Marketable。「マーケティングを通じて、企業を売れる状態にする」
- UI / ドキュメント / コミットメッセージでは上記表記を統一。略称 `Markable` / `マーカブル` も可

## 参照ドキュメント

詳細は以下を参照:
- `docs/PROJECT_SPEC.md` — プロダクト全体仕様
- `docs/ARCHITECTURE.md` — システム構成
- `docs/modules/aeo.md` — AEO モジュール
- `docs/modules/seo.md` — SEO モジュール
- `docs/modules/nurturing.md` — ナーチャリングモジュール
- `docs/modules/approval-queue.md` — 承認キュー
