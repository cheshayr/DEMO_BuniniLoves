import { Link } from 'react-router-dom'
import { useSettings } from '@/context/SettingsContext'
import { Star } from '@/components/ui/Doodles'

export function AnnouncementBar() {
  const { announcement } = useSettings()
  if (!announcement?.enabled || !announcement.text) return null
  const inner = (
    <span className="inline-flex items-center gap-2">
      <Star className="h-3.5 w-3.5 text-ink-950" /> {announcement.text} <Star className="h-3.5 w-3.5 text-ink-950" />
    </span>
  )
  return (
    <div className="border-b-2 border-ink-950 bg-star py-2 text-center font-display text-[13px] font-semibold text-ink-950">
      {announcement.link ? <Link to={announcement.link} className="hover:underline">{inner}</Link> : inner}
    </div>
  )
}
