// Thin wrapper over jSuites.modal so callers don't have to know the jSuites
// option shape. Returns a controller that can close the modal programmatically.

import jSuites from 'jsuites'

export interface ModalController {
  close: () => void
  el: HTMLElement
}

export interface ModalOptions {
  title: string
  width?: number
  height?: number
  /** Body content — either an HTMLElement or an HTML string (we'll wrap the string in a div). */
  body: HTMLElement | string
  /** Called when the modal closes (X click, escape, or .close()). */
  onClose?: () => void
}

export function openModal(options: ModalOptions): ModalController {
  const container = document.createElement('div')

  if (typeof options.body === 'string') {
    container.innerHTML = options.body
  } else {
    container.appendChild(options.body)
  }

  // jSuites.modal expects the element to be in the DOM. Append before init.
  document.body.appendChild(container)

  const instance = jSuites.modal(container, {
    title: options.title,
    width: options.width ?? 480,
    height: options.height,
    closed: false, // open immediately
    onclose: () => {
      options.onClose?.()
      // Detach from DOM after close so successive opens don't accumulate.
      requestAnimationFrame(() => {
        if (container.parentNode) {
          container.parentNode.removeChild(container)
        }
      })
    },
  })

  return {
    el: container,
    close: () => instance.close(),
  }
}
