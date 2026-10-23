import { Link } from 'react-router-dom'
import { Cloud } from '@/components/ui/Doodles'

export default function Placeholder({ title, phase, note }: { title: string; phase: string; note?: string }) {
  return (
    <section className="container-x grid min-h-[55dvh] place-items-center py-16 text-center">
      <div>
        <Cloud className="mx-auto w-24 animate-floaty text-cloud" />
        <p className="eyebrow mt-4">coming in {phase}</p>
        <h1 className="mt-2 text-4xl font-semibold">{title}</h1>
        {note && <p className="mx-auto mt-3 max-w-md text-milk/60">{note}</p>}
        <Link to="/" className="btn-ghost mt-6">Back home</Link>
      </div>
    </section>
  )
}
