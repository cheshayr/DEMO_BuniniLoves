const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Prices are stored as integer centavos in the database; format for display. */
export const formatPHP = (centavos: number) => peso.format(centavos / 100)

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  new Intl.DateTimeFormat('en-PH', opts).format(new Date(iso))
