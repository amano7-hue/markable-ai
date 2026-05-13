import { SignIn } from '@clerk/nextjs'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const params = await searchParams
  const redirectUrl = params.redirect_url

  return (
    <SignIn
      fallbackRedirectUrl={redirectUrl || '/dashboard'}
      signUpFallbackRedirectUrl={redirectUrl || '/dashboard'}
    />
  )
}
