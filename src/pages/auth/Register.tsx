import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registerSchema, type RegisterForm } from '@/lib/validation'
import { Field } from '@/components/ui/Field'
import { AuthShell, FormMessage } from './AuthShell'

export default function Register() {
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (v: RegisterForm) => {
    setError(null)
    const { error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { full_name: v.fullName, username: v.username || null },   // roles are NOT accepted from the client
        emailRedirectTo: `${window.location.origin}/account`,
      },
    })
    if (error) {
      setError(error.message.toLowerCase().includes('username') || error.message.toLowerCase().includes('database')
        ? 'That username may already be taken. Try another one.'
        : error.message)
      return
    }
    // Demo: accounts are created and signed in instantly (no email step).
    window.location.hash = '#/account'
    setSentTo(v.email)
  }

  if (sentTo) {
    return (
      <AuthShell title="check your inbox" subtitle="One more step!">
        <div className="grid justify-items-center gap-3 text-center">
          <MailCheck className="h-12 w-12 text-bun-ribbon" />
          <p className="text-milk/80">We sent a confirmation link to <strong className="text-bun-ribbon">{sentTo}</strong>. Verify your email to start shopping.</p>
          <Link to="/login" className="btn-ghost mt-2">Back to sign in</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="create account" subtitle="Track orders, save favorites and review your purchases.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <Field label="Full name" autoComplete="name" error={errors.fullName?.message} {...register('fullName')} />
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Username (optional)" autoComplete="username" error={errors.username?.message} {...register('username')} />
        <Field label="Password" type="password" autoComplete="new-password" hint="8+ characters with a letter and a number" error={errors.password?.message} {...register('password')} />
        <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-milk/60">Already registered? <Link to="/login" className="font-semibold text-bun-ribbon hover:underline">Sign in</Link></p>
    </AuthShell>
  )
}
