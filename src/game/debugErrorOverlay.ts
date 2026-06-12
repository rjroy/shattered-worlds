function formatError(reason: unknown): string {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}${reason.stack === undefined ? '' : `\n${reason.stack}`}`
  }

  if (typeof reason === 'string') return reason

  try {
    return JSON.stringify(reason, null, 2)
  } catch {
    return String(reason)
  }
}

function showError(message: string): void {
  const existing = document.getElementById('shattered-worlds-error-overlay')
  const panel = existing ?? document.createElement('pre')

  panel.id = 'shattered-worlds-error-overlay'
  panel.textContent = message
  panel.style.position = 'fixed'
  panel.style.left = '8px'
  panel.style.right = '8px'
  panel.style.top = '8px'
  panel.style.maxHeight = '70vh'
  panel.style.overflow = 'auto'
  panel.style.zIndex = '2147483647'
  panel.style.margin = '0'
  panel.style.padding = '12px'
  panel.style.background = 'rgba(32, 0, 0, 0.94)'
  panel.style.color = '#ffe6e6'
  panel.style.border = '2px solid #ff7777'
  panel.style.borderRadius = '6px'
  panel.style.font = '12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  panel.style.whiteSpace = 'pre-wrap'
  panel.style.userSelect = 'text'
  panel.style.touchAction = 'pan-y'

  if (existing === null) document.body.append(panel)
}

export function installDebugErrorOverlay(): void {
  window.addEventListener('error', (event) => {
    const details = event.error === undefined || event.error === null ? event.message : formatError(event.error)
    showError(`Runtime error\n${details}`)
  })

  window.addEventListener('unhandledrejection', (event) => {
    showError(`Unhandled promise rejection\n${formatError(event.reason)}`)
  })
}
