'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Upload, Trash2, ExternalLink, FileDown } from 'lucide-react'

type ArticleLink = {
  id: string
  title: string
  url: string
  keywords: string | null
  createdAt: Date
}

export default function RelatedArticlesManager({
  projectId,
  initialLinks,
}: {
  projectId: string
  initialLinks: ArticleLink[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [links, setLinks] = useState(initialLinks)
  const [replaceAll, setReplaceAll] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadStatus('アップロード中...')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('projectId', projectId)
    fd.append('replaceAll', String(replaceAll))

    const res = await fetch('/api/seo/related-articles', { method: 'POST', body: fd })
    const json = await res.json()

    if (!res.ok) {
      setUploadStatus(`エラー: ${json.error ?? 'アップロード失敗'}`)
    } else {
      setUploadStatus(`${json.data.inserted} 件を登録しました`)
      startTransition(() => router.refresh())
      // Fetch updated list
      const listRes = await fetch(`/api/seo/related-articles?projectId=${projectId}`)
      const listJson = await listRes.json()
      if (listRes.ok) setLinks(listJson.data)
    }
    // reset input
    e.target.value = ''
    setTimeout(() => setUploadStatus(null), 4000)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/seo/related-articles?id=${id}`, { method: 'DELETE' })
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  async function handleDeleteAll() {
    await fetch(`/api/seo/related-articles?projectId=${projectId}`, { method: 'DELETE' })
    setLinks([])
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <div className="rounded-lg border border-dashed p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="replace-all"
              checked={replaceAll}
              onCheckedChange={(v) => setReplaceAll(!!v)}
            />
            <Label htmlFor="replace-all" className="text-sm cursor-pointer">
              既存リストを上書き（チェックなしの場合は追加）
            </Label>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            CSV / XLSX をアップロード
          </Button>
          {uploadStatus && (
            <span className="text-sm text-muted-foreground">{uploadStatus}</span>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>対応フォーマット：CSV / XLSX（1行目はヘッダー行）</p>
          <p>必須列：<code>title</code>（または「タイトル」）、<code>url</code></p>
          <p>任意列：<code>keywords</code>（または「キーワード」）— カンマ区切りで記事の関連キーワードを指定</p>
        </div>

        <a
          href={`data:text/csv;charset=utf-8,title,url,keywords\n記事タイトルの例,https://example.com/article-1,SEO%2Fコンテンツマーケティング`}
          download="related-articles-template.csv"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <FileDown className="h-3 w-3" />
          テンプレートCSVをダウンロード
        </a>
      </div>

      {/* Table */}
      {links.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{links.length} 件</p>
            <AlertDialog>
              <AlertDialogTrigger>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" type="button">
                  <Trash2 className="mr-1 h-3 w-3" />
                  全削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>関連記事リンクを全削除しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    この操作は取り消せません。登録済みの {links.length} 件がすべて削除されます。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    削除する
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>タイトル</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>キーワード</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">{link.title}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-sm truncate max-w-[180px]"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{link.url}</span>
                      </a>
                    </TableCell>
                    <TableCell>
                      {link.keywords ? (
                        <div className="flex flex-wrap gap-1">
                          {link.keywords.split(',').slice(0, 3).map((kw) => (
                            <Badge key={kw} variant="secondary" className="text-xs">
                              {kw.trim()}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(link.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm">
          記事リンクがまだ登録されていません。上のボタンからCSV/XLSXをアップロードしてください。
        </div>
      )}
    </div>
  )
}
