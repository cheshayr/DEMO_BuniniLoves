import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { emailSchema } from '@/lib/validation'
import { Field } from '@/components/ui/Field'
import { AuthShell, FormMessage } from './AuthShell'

export default function ForgotPassword() {
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(emailSchema) })

  const onSubmit = async ({ email }: { email: string }) => {
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setDone(true) // same message whether or not the account exists (no account enumeration)
  }

  return (
    <AuthShell title="reset password" subtitle="We'll email you a link to choose a new one.">
      {done ? (
        <FormMessage kind="success">If an account exists for that email, a reset link is on its way.</FormMessage>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <Field label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <button className="btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm"><Link to="/login" className="text-milk/60 hover:text-bun-ribbon">← Back to sign in</Link></p>
    </AuthShell>
  )
}
