export function installEditorSplit(panel: HTMLElement) {
  const container = panel.parentElement!
  const handle = document.createElement('div')
  handle.className = 'editor-split'
  handle.tabIndex = 0
  handle.setAttribute('role', 'separator')
  handle.setAttribute('aria-orientation', 'horizontal')
  handle.setAttribute('aria-label', '调整文件与终端高度')
  handle.title = '拖动调整高度，双击恢复默认'
  panel.after(handle)
  let ratio = 0.45
  try { const saved = Number(localStorage.getItem('ssh.editorRatio')); if (saved >= 0.15 && saved <= 0.85) ratio = saved } catch {}
  function available() {
    const style = getComputedStyle(container)
    return Math.max(0, container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - handle.offsetHeight - 2 * parseFloat(style.rowGap || '0'))
  }
  function layout() {
    handle.hidden = panel.hidden
    if (panel.hidden) return
    const height = available()
    const minimum = Math.min(120, height / 2)
    const pixels = Math.max(minimum, Math.min(height - minimum, height * ratio))
    panel.style.height = `${pixels}px`
    handle.setAttribute('aria-valuemin', '15')
    handle.setAttribute('aria-valuemax', '85')
    handle.setAttribute('aria-valuenow', String(Math.round(ratio * 100)))
  }
  function setRatio(value: number) {
    ratio = Math.max(0.15, Math.min(0.85, value))
    layout()
    try { localStorage.setItem('ssh.editorRatio', String(ratio)) } catch {}
  }
  let drag: { id: number; y: number; height: number } | undefined
  handle.onpointerdown = event => {
    if (event.button !== 0) return
    event.preventDefault()
    drag = { id: event.pointerId, y: event.clientY, height: panel.getBoundingClientRect().height }
    handle.setPointerCapture(event.pointerId)
    container.classList.add('resizing-editor')
  }
  handle.onpointermove = event => {
    if (drag?.id === event.pointerId && available() > 0) setRatio((drag.height + event.clientY - drag.y) / available())
  }
  const stop = () => { drag = undefined; container.classList.remove('resizing-editor') }
  handle.onpointerup = event => { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); stop() }
  handle.onpointercancel = stop
  handle.onlostpointercapture = stop
  handle.ondblclick = () => setRatio(0.45)
  handle.onkeydown = event => {
    if (!['ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
    event.preventDefault()
    setRatio(event.key === 'Home' ? 0.45 : ratio + (event.key === 'ArrowUp' ? -0.05 : 0.05))
  }
  new ResizeObserver(layout).observe(container)
  return layout
}
