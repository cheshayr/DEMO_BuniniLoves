import type { ReactNode } from 'react'
import { Cloud, Heart, Star } from '@/components/ui/Doodles'
import { isSupabaseConfigured } from '@/lib/supabase'
import { asset } from '@/lib/assets'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="relative overflow-hidden py-12 sm:py-20">
      <Star className="absolute left-[8%] top-16 hidden w-8 animate-twinkle text-sun sm:block" />
      <Cloud className="absolute right-[6%] top-24 hidden w-24 animate-floaty text-cloud sm:block" />
      <Heart className="absolute bottom-20 left-[12%] hidden w-9 animate-floaty text-bun-ribbon sm:block" />
      <div className="container-x relative">
        <div className="card mx-auto max-w-md p-6 sm:p-9">
          <img src={asset('/art/bunny-glasses.png')} alt="" width={64} height={64} className="-mt-14 mb-1 h-20 w-20 -rotate-6 rounded-full border-2 border-ink-950 bg-bun-soft shadow-sticker" />
          <p className="eyebrow mt-2">welcome</p>
          <h1 className="mt-1 text-3xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-milk/60">{subtitle}</p>
          {!isSupabaseConfigured && (
            <p role="alert" className="mt-4 rounded-2xl border-2 border-ink-950 bg-star/60 p-3 text-sm font-semibold text-ink-950">
              Supabase isn't configured yet. Add your keys to <code>.env.local</code> (see SETUP.md).
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  )
}

export function FormMessage({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'}
       className={`rounded-2xl p-3 text-sm ${kind === 'error' ? 'bg-bun-deep/15 text-bun-ribbon' : 'bg-star/50 text-bun-ribbon'}`}>
      {children}
    </p>
  )
}
