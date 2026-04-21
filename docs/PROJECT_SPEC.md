# PROJECT SPEC — Markeble AI (マーケブルAI)

本ドキュメントは、Markeble AI のプロダクト仕様および設計方針をまとめたもの。Claude Code での開発時は、各セッションの冒頭でこのファイルを参照すること。

## プロダクト概要

BtoB 企業向けのマーケティング自動化 AI。マーケティング担当者が AI 検索対策・SEO・メールナーチャリングを半自動で回せるようにし、企業を「売れる状態 (marketable)」へと導く。AI が下書き・提案を生成し、人間が承認キューでレビュー・編集・公開する Human-in-the-Loop 型の運用を基本とする。

差別化の核は AI 検索対策 (AEO) モジュール。既存の SEO ツールがまだ本格対応していない ChatGPT・Perplexity・Google AI Overview・Gemini での引用・言及を追跡し、改善提案を生成する。

### プロダクト名・ブランド

- 正式名: **Markeble AI** (英語表記)
- 日本語表記: **マーケブルAI**
- 略称: Markeble / マーケブル
- 語源: Marketing × Marketable。BtoB マーケティング全領域を AI が自動化し、企業を「売れる状態」にするという価値を表現

## ターゲット顧客

BtoB 企業全般を対象とするが、初期 GTM のフォーカスは別途決定する (候補: BtoB SaaS/テック、プロフェッショナルサービス、製造業、BtoB サービス)。業界による AI 検索浸透度の差を考慮し、初期はテック/SaaS 寄りから攻めるのが有力候補。

## モジュール構成

### 1. AEO モジュール (AI 検索対策)

**目的**: 主要 LLM (ChatGPT、Perplexity、Gemini、Google AI Overview、AI Mode) で自社ブランド・コンテンツが引用・言及される頻度を追跡し、改善提案を生成する。

**主要機能**:
- プロンプト管理 (追跡したいクエリの CRUD)
- 日次ランキング追跡 (Seranking AIRT 経由)
- 競合との Share of Voice 比較 (Seranking Data API 経由)
- 引用ギャップ診断 (競合が引用されて自社が引用されないプロンプトの検出)
- AEO 改善提案の自動生成 (承認キューへ投入)
- 業界別プロンプトテンプレート

**データソース**:
- Seranking AI Search API (Data API) — 市場全体の可視化、月次更新、高コスト (leaderboard 7,500 credits/req)
- Seranking AI Result Tracker API (Project API) — 顧客指定プロンプトの日次追跡
- Anthropic API (将来) — Claude の追跡、および Seranking が未対応の補完

**制約**:
- Seranking は Claude をエンジンとして未サポート。v2 で自前補完を検討
- 日本語プロンプトデータベースの充足度は契約前に実機検証が必須

### 2. SEO モジュール

**目的**: 従来型の検索エンジン経由の流入を最大化する。

**主要機能**:
- キーワードクラスタリング (バイヤーインテント単位)
- 競合コンテンツ差分分析
- 記事ブリーフ・ドラフト生成 (承認キューへ投入)
- 内部リンク提案
- テクニカル SEO 監査
- 順位モニタリング

**データソース**:
- Google Search Console API — 自社の検索実データ (表示・クリック・順位)
- Seranking API — 順位モニタリング、キーワード調査、バックリンク、サイト監査

### 3. ナーチャリングモジュール

**目的**: サイト流入したリードを育成し商談化につなげる。

**主要機能**:
- 行動ベースの自動セグメント
- ICP スコアリング
- セグメント別メールドラフト生成 (承認キューへ投入)
- 送信タイミング最適化
- A/B テスト
- リードスコアリングの CRM 同期

**データソース**:
- Google Analytics 4 API — サイト行動、コンバージョン
- CRM API (HubSpot を優先、Salesforce/kintone は後続) — リード情報、商談ステージ
- メール配信基盤 (v1 は HubSpot/Marketo 連携で逃げる。自前配信は v2 以降)

### 4. 承認キュー (Approval Queue)

**目的**: 全モジュールの AI 生成物 (記事ドラフト、メール文面、AEO 改善提案、キーワード案) を一元管理し、人間が高速にレビュー・編集・承認できる UX を提供する。

**主要機能**:
- 差分表示 (Before/After)
- インライン編集
- ワンクリック承認・差し戻し
- 優先度ソート (インパクト予測 × 期限)
- 承認履歴・監査ログ

**重要**: このモジュールが UX の中核。承認体験の高速性が顧客の稼働率と解約率を直接左右する。

### 5. 統合データ基盤

**目的**: GA4 / GSC / Seranking / AEO ソース / CRM / メール配信のデータを一元化し、「どの施策が、どのコンテンツの順位を動かし、流入を増やし、リードと商談を生んだか」をアトリビューションできるようにする。

**主要コンポーネント**:
- 取り込み層 (Ingestion) — Inngest ジョブで日次同期
- 正規化層 — URL / キーワード / リード / プロンプトを共通キーで結合
- データストア — Postgres (将来必要なら BigQuery/ClickHouse 移行)
- 派生指標層 — ICP スコア、AEO インパクトスコア、コンテンツ効果測定

## 業界パック (Industry Pack)

コア機能は汎用、業界特化は設定・テンプレートでカバーする方針。

- 業界別 ICP テンプレート
- キーワードセット・検索意図マップ
- AEO プロンプトテンプレート
- コンテンツフレームワーク
- メールナーチャリングシーケンス

初期は1〜2業界のみ提供し、顧客獲得と連動して拡張する。

## 連携先優先順位

**v1 必須**:
- 認証: Google OAuth (GA4/GSC アクセス)
- SEO データ: Seranking API
- 解析: Google Analytics 4 API, Google Search Console API
- CRM: HubSpot (BtoB での採用率が最も高い)

**v1.1〜**:
- Salesforce, kintone, Senses (Mazrica)
- Marketo, Pardot, SATORI, List Finder
- CMS 連携: WordPress (製造業), Webflow (SaaS/スタートアップ)

## マルチテナント設計の原則

- 全テーブルに `tenantId` を必須カラムとして持つ
- Prisma middleware で全クエリに `tenantId` を自動付与
- Postgres Row-Level Security で二重防御
- 外部 API の認証情報はテナント単位で暗号化保存 (AWS KMS または類似)
- テスト環境では必ずテナント分離のリークテストを含める

## 非機能要件

- **可用性**: v1 は SLA 99.5%。重要バッチ失敗時は Slack 通知
- **セキュリティ**: OWASP Top 10 準拠。SOC2 取得は v2 以降の検討事項
- **個人情報**: 日本 APPI + 特商法対応。メール配信停止リンクは必須
- **監査ログ**: 承認キューでの操作は全て記録 (誰が何をいつ承認したか)
- **API コスト管理**: Seranking credits の使用状況をダッシュボード化。テナント単位でクォータ設定

## ロードマップ (案)

**Phase 0 (基盤)**: プロジェクト初期化、マルチテナント基盤、統合データ基盤の骨格

**Phase 1 (AEO MVP)**: Seranking 連携、プロンプト管理、日次追跡、承認キュー v0.1

**Phase 2 (SEO + ナーチャリング v1)**: GSC/GA4 連携、記事ドラフト生成、HubSpot 連携、メール下書き生成

**Phase 3 (アトリビューション)**: 施策 → 順位 → 流入 → リード → 商談 の横断分析

**Phase 4 (業界パック拡張・Claude 対応・日本語 AEO 強化)**
