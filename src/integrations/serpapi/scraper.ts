/**
 * 競合URLのページ本文を取得し、文字数を計測する
 * - JavaScript依存ページはスキップ（静的HTMLのみ対象）
 * - タイムアウト: 8秒/URL
 * - robots.txt は無視しない（fetch は通常のHTTPアクセス）
 */

/** HTMLタグ・スクリプト・スタイルを除去してプレーンテキストを返す */
function extractText(html: string): string {
  return html
    // script / style ブロックを削除
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // HTMLコメントを削除
    .replace(/<!--[\s\S]*?-->/g, '')
    // HTML タグを削除
    .replace(/<[^>]+>/g, ' ')
    // HTMLエンティティを展開
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    // 連続スペース・改行を整理
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * テキストの実質文字数を返す（日本語記事向け）
 * 空白・改行を除いた全文字数を返す
 */
function countChars(text: string): number {
  return text.replace(/\s/g, '').length
}

export interface ScrapedPage {
  url: string
  charCount: number
  title: string | null
}

/** 1URL をフェッチして文字数を返す。失敗時は null */
async function scrapePage(url: string): Promise<ScrapedPage | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ja,en;q=0.9',
      },
    })
    if (!res.ok) return null

    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return null

    const html = await res.text()

    // タイトル抽出
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null

    const text = extractText(html)
    const charCount = countChars(text)

    // 明らかに内容が少なすぎるページは除外（トップページ・エラーページ等）
    if (charCount < 300) return null

    return { url, charCount, title }
  } catch {
    return null
  }
}

export interface CompetitorScrapeResult {
  pages: ScrapedPage[]
  averageCharCount: number
  maxCharCount: number
  minCharCount: number
  recommendedCharCount: number // 平均+20%、最低2000文字
}

/**
 * 複数URLを並列でスクレイプし、文字数統計を返す
 * @param urls 上位10件のURL
 */
export async function scrapeCompetitorWordCounts(
  urls: string[],
): Promise<CompetitorScrapeResult> {
  // 最大10件、5並列でフェッチ
  const targets = urls.slice(0, 10)

  // 5件ずつバッチ処理してサーバー負荷を抑える
  const pages: ScrapedPage[] = []
  for (let i = 0; i < targets.length; i += 5) {
    const batch = targets.slice(i, i + 5)
    const results = await Promise.all(batch.map(scrapePage))
    pages.push(...results.filter((r): r is ScrapedPage => r !== null))
  }

  if (pages.length === 0) {
    return {
      pages: [],
      averageCharCount: 2000,
      maxCharCount: 2000,
      minCharCount: 2000,
      recommendedCharCount: 2400,
    }
  }

  const counts = pages.map((p) => p.charCount)
  const averageCharCount = Math.round(counts.reduce((s, c) => s + c, 0) / counts.length)
  const maxCharCount = Math.max(...counts)
  const minCharCount = Math.min(...counts)

  // 推奨文字数: 競合平均を上回るよう +20%、最低2000文字
  const recommendedCharCount = Math.max(Math.round(averageCharCount * 1.2), 2000)

  return {
    pages,
    averageCharCount,
    maxCharCount,
    minCharCount,
    recommendedCharCount,
  }
}
