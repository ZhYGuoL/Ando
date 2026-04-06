import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type StackEntry = { path: string; label: string }

type NavStackContextValue = {
  /** Call before navigate: records current path for the next screen's back control */
  pushBackAnchor: (labelForCurrentScreen: string) => void
  goBack: () => void
  peekBackLabel: () => string | null
  clearStack: () => void
}

const NavStackContext = createContext<NavStackContextValue | null>(null)

export function NavStackProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>([])
  const navigate = useNavigate()
  const location = useLocation()

  const pushBackAnchor = useCallback(
    (labelForCurrentScreen: string) => {
      setStack((s) => [
        ...s,
        { path: location.pathname + location.search, label: labelForCurrentScreen },
      ])
    },
    [location.pathname, location.search],
  )

  const goBack = useCallback(() => {
    setStack((s) => {
      if (s.length === 0) return s
      const prev = s[s.length - 1]!
      navigate(prev.path)
      return s.slice(0, -1)
    })
  }, [navigate])

  const peekBackLabel = useCallback(() => {
    return stack.length === 0 ? null : stack[stack.length - 1]!.label
  }, [stack])

  const clearStack = useCallback(() => {
    setStack([])
  }, [])

  const value = useMemo(
    () => ({ pushBackAnchor, goBack, peekBackLabel, clearStack }),
    [pushBackAnchor, goBack, peekBackLabel, clearStack],
  )

  return <NavStackContext.Provider value={value}>{children}</NavStackContext.Provider>
}

export function useNavStack() {
  const ctx = useContext(NavStackContext)
  if (!ctx) throw new Error('useNavStack requires NavStackProvider')
  return ctx
}
