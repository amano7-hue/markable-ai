import type { Metadata } from 'next'
import { Noto_Sans_JP, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const notoSansJP = Noto_Sans_JP({
  variable: '--font-noto-sans-jp',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Markable AI',
    template: '%s | Markable AI',
  },
  description: 'BtoB マーケティング自動化 AI — LLMO・SEO・ナーチャリングを半自動化',
  icons: {
    icon: '/logo-mark.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="ja" className={`${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}
