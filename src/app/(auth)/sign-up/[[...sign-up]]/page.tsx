import { SignUp } from '@clerk/nextjs'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const redirectUrl = params.redirect_url

  return (
    <SignUp
      fallbackRedirectUrl={redirectUrl || '/dashboard'}
    />
  )
}
