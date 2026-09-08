type Side = 'left' | 'right'

interface ResizablePanel {
  panel: HTMLElement
  side: Side
  key: string
  minimum: number
  maximum: number
  defaultWidth: number
  visible: () => boolean
}

/** Pointer and keyboard accessible horizontal panel resizing with local preference storage. */
export function installPanelSplits(container: HTMLElement, panels: ResizablePanel[]): void {
  for (const config of panels) {
    const handle = document.createElement('div')
    handle.className = `panel-split panel-split-${config.side}`
    handle.tabIndex = 0
    handle.setAttribute('role', 'separator')
    handle.setAttribute('aria-orientation', 'vertical')
    handle.setAttribute('aria-label', config.side === 'left' ? '调整文件面板宽度' : '调整右侧面板宽度')
    handle.title = '拖动调整宽度，双击恢复默认'
    if (config.side === 'left') config.panel.after(handle)
    else config.panel.before(handle)

    let width = config.defaultWidth
    try { const saved = Number(localStorage.getItem(config.key)); if (saved >= config.minimum && saved <= config.maximum) width = saved } catch {}
    const apply = (value = width) => {
      // The iframe can report zero width during initial slot composition. Keep the intended
      // width until it has a real layout instead of permanently collapsing to the minimum.
      if (container.clientWidth < config.minimum + 240) {
        config.panel.style.width = `${width}px`
        handle.hidden = !config.visible()
        return
      }
      const centerMinimum = Math.min(420, Math.max(240, container.clientWidth * 0.35))
      const otherWidths = panels.filter(item => item !== config && item.visible()).reduce((sum, item) => sum + item.panel.getBoundingClientRect().width + 8, 0)
      const available = Math.max(config.minimum, container.clientWidth - centerMinimum - otherWidths - 8)
      width = Math.round(Math.max(config.minimum, Math.min(config.maximum, available, value)))
      config.panel.style.width = `${width}px`
      handle.hidden = !config.visible()
      handle.setAttribute('aria-valuemin', String(config.minimum))
      handle.setAttribute('aria-valuemax', String(Math.min(config.maximum, available)))
      handle.setAttribute('aria-valuenow', String(width))
    }
    const save = () => { try { localStorage.setItem(config.key, String(width)) } catch {} }
    let drag: { id: number; x: number; width: number } | undefined
    handle.onpointerdown = event => {
      if (event.button !== 0 || handle.hidden) return
      event.preventDefault(); drag = { id: event.pointerId, x: event.clientX, width }
      handle.setPointerCapture(event.pointerId); container.classList.add('resizing-panels')
    }
    handle.onpointermove = event => {
      if (drag?.id !== event.pointerId) return
      const delta = event.clientX - drag.x
      apply(drag.width + (config.side === 'left' ? delta : -delta))
    }
    const stop = () => { if (drag) save(); drag = undefined; container.classList.remove('resizing-panels') }
    handle.onpointerup = event => { if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId); stop() }
    handle.onpointercancel = stop; handle.onlostpointercapture = stop
    handle.ondblclick = () => { apply(config.defaultWidth); save() }
    handle.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','Home'].includes(event.key)) return
      event.preventDefault()
      const delta = event.key === 'Home' ? 0 : (event.key === 'ArrowRight' ? 20 : -20) * (config.side === 'left' ? 1 : -1)
      apply(event.key === 'Home' ? config.defaultWidth : width + delta); save()
    }
    const observer = new MutationObserver(() => apply())
    observer.observe(config.panel,{attributes:true,attributeFilter:['hidden']})
    observer.observe(container,{attributes:true,attributeFilter:['class']})
    new ResizeObserver(() => apply()).observe(container)
    apply()
  }
}
