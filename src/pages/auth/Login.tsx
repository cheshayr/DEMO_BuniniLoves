import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { loginSchema, type LoginForm } from '@/lib/validation'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { AuthShell, FormMessage } from './AuthShell'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/account'
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  if (user) return <Navigate to={from} replace />

  const onSubmit = async (v: LoginForm) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) {
      setError(error.message.toLowerCase().includes('email not confirmed')
        ? 'Please verify your email first. Check your inbox for the confirmation link.'
        : 'Incorrect email or password.')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthShell title="sign in" subtitle="Good to see you again ♡">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Field label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <Link to="/forgot-password" className="-mt-1 justify-self-end text-sm text-milk/60 hover:text-bun-ribbon">Forgot password?</Link>
        <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-milk/60">New here? <Link to="/register" className="font-semibold text-bun-ribbon hover:underline">Create an account</Link></p>
    </AuthShell>
  )
}
