import { useNavigate } from 'react-router-dom'
import {
  BACKEND_PERMISSION_MESSAGE_ID,
  FRONTEND_PERMISSION_MESSAGE_ID,
  useNaveStore,
} from '../../store'

function showDemoChrome(): boolean {
  if (import.meta.env.DEV) return true
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1'
  } catch {
    return false
  }
}

/** Dev / ?demo=1 — resets store and jumps for repeatable recording takes. */
export function DemoControls() {
  const navigate = useNavigate()
  const demoReset = useNaveStore((s) => s.demoReset)
  const permissionApprove = useNaveStore((s) => s.permissionApprove)

  if (!showDemoChrome()) return null

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[200] max-w-[min(18rem,calc(100vw-2rem))] rounded-[6px] border border-[#d4d0c8] bg-white px-4 py-3 text-[13px] text-[#0f0f0f]"
      aria-label="Demo controls"
    >
      <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Demo</p>
      <p className="mt-2 leading-snug text-[#5f5f5f]">
        Reset restores the human-only thread. In #frontend, @Patch from the composer to spawn sub-processes,
        then shortcut-approve here if you want.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-3 py-2 text-left text-[13px] hover:bg-[#ebebeb]"
          onClick={() => {
            demoReset()
            navigate('/?channel=frontend')
          }}
        >
          Reset demo
        </button>
        <button
          type="button"
          className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-3 py-2 text-left text-[13px] hover:bg-[#ebebeb]"
          onClick={() => permissionApprove(FRONTEND_PERMISSION_MESSAGE_ID)}
        >
          Approve Patch permission
        </button>
        <button
          type="button"
          className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-3 py-2 text-left text-[13px] hover:bg-[#ebebeb]"
          onClick={() => permissionApprove(BACKEND_PERMISSION_MESSAGE_ID)}
        >
          Approve Scout permission
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="nave-float nave-rise flex-1 rounded-[4px] border border-[#d4d0c8] px-2 py-1.5 text-[13px] hover:bg-[#ebebeb]"
            onClick={() => navigate('/home')}
          >
            Home
          </button>
          <button
            type="button"
            className="nave-float nave-rise flex-1 rounded-[4px] border border-[#d4d0c8] px-2 py-1.5 text-[13px] hover:bg-[#ebebeb]"
            onClick={() => navigate('/?channel=frontend')}
          >
            #frontend
          </button>
          <button
            type="button"
            className="nave-float nave-rise flex-1 rounded-[4px] border border-[#d4d0c8] px-2 py-1.5 text-[13px] hover:bg-[#ebebeb]"
            onClick={() => navigate('/?channel=infra')}
          >
            #infra
          </button>
        </div>
      </div>
    </div>
  )
}
