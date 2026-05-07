export interface WpPost {
  id: number
  link: string
  slug: string
  status: string
}

export class WordPressClient {
  private readonly baseUrl: string
  private readonly authHeader: string

  constructor(siteUrl: string, username: string, appPassword: string) {
    this.baseUrl = siteUrl.replace(/\/$/, '')
    this.authHeader = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`
  }

  async createPost(opts: {
    title: string
    content: string
    excerpt?: string
    status?: 'publish' | 'draft' | 'pending'
    categories?: number[]
    tags?: number[]
  }): Promise<WpPost> {
    const res = await fetch(`${this.baseUrl}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: opts.title,
        content: opts.content,
        excerpt: opts.excerpt ?? '',
        status: opts.status ?? 'publish',
        ...(opts.categories ? { categories: opts.categories } : {}),
        ...(opts.tags ? { tags: opts.tags } : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`WordPress API error ${res.status}: ${body}`)
    }

    return res.json() as Promise<WpPost>
  }

  async testConnection(): Promise<{ name: string; url: string }> {
    const res = await fetch(`${this.baseUrl}/wp-json/wp/v2/users/me`, {
      headers: { Authorization: this.authHeader },
    })
    if (!res.ok) throw new Error(`WordPress 接続エラー: ${res.status}`)
    const user = (await res.json()) as { name: string; link: string }
    return { name: user.name, url: this.baseUrl }
  }
}
