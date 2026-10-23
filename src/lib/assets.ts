/** Resolves a file in /public so it also works when the site is served from a sub-path (GitHub Pages). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

/**
 * Real photos live in /public/photos (sticker.png, nb.png, stationery.png, bz1.png, bz2.png, bz3.png).
 * If one is missing, a generated picture is shown instead of a broken image.
 */
export function installPhotoFallback(fallbacks: Record<string, string>) {
  document.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement) || img.dataset.fallback) return
    const name = decodeURIComponent(img.src.split('?')[0].split('/').pop() ?? '')
    const alt = fallbacks[name]
    if (alt) { img.dataset.fallback = '1'; img.src = alt }
  }, true)
}
