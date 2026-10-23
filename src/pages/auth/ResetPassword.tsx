import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { newPasswordSchema } from '@/lib/validation'
import { Field } from '@/components/ui/Field'
import { useAuth } from '@/context/AuthContext'
import { AuthShell, FormMessage } from './AuthShell'

type Form = { password: string; confirm: string }

export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(newPasswordSchema) })

  const onSubmit = async (v: Form) => {
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) return setError(error.message)
    navigate('/account', { replace: true })
  }

  return (
    <AuthShell title="new password" subtitle="Choose something you'll remember.">
      {!loading && !user ? (
        <FormMessage kind="error">This reset link is invalid or has expired. Please request a new one.</FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <Field label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <Field label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Update password'}</button>
        </form>
      )}
    </AuthShell>
  )
}
