import { useEffect, useState } from 'react'

export interface AsyncState<T> { data: T | null; loading: boolean; error: string | null }

/** Tiny data-loading hook: re-runs when deps change, ignores stale responses. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => alive && setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Something went wrong' }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
