import { useEffect } from 'react'

/**
 * Global keyboard shortcuts for navigation.
 * Cmd/Ctrl + K → focus search (future)
 * Cmd/Ctrl + N → new job
 * Cmd/Ctrl + D → dashboard
 * Cmd/Ctrl + H → history
 */
export function useKeyboardShortcuts(navigateTo) {
  useEffect(() => {
    const handler = (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return

      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'n') {
        e.preventDefault()
        navigateTo('new-job')
      } else if (isMod && e.key === 'd') {
        e.preventDefault()
        navigateTo('dashboard')
      } else if (isMod && e.key === 'h') {
        e.preventDefault()
        navigateTo('history')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigateTo])
}
