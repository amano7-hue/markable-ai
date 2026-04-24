'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  text: string
  label?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export default function CopyButton({ text, label = 'コピー', size = 'sm' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button size={size} variant="outline" onClick={handleCopy}>
      {copied ? '✓ コピー済み' : label}
    </Button>
  )
}
