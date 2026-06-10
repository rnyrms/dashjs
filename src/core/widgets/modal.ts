// Modal helpers.
// openModal      — thin wrapper over jSuites.modal (used by existing callers)
// openNativeModal — pure DOM/CSS modal, no jSuites; use when you need full
//                   control over the content layout (e.g. interactive forms).

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

/** Lightweight modal that owns its own DOM — no jSuites involved.
 *  Returns a controller whose `.el` is the inner content container. */
export function openNativeModal(options: ModalOptions): ModalController {
  const overlay = document.createElement('div')
  overlay.className = 'dashjs-native-modal-overlay'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  // Inherit the dashjs CSS variable scope so custom properties resolve correctly.
  overlay.setAttribute('data-dashjs', '')
  const themeEl = document.querySelector<HTMLElement>('[data-dashjs-theme]')
  if (themeEl) overlay.setAttribute('data-dashjs-theme', themeEl.dataset.dashjsTheme ?? '')

  const dialog = document.createElement('div')
  dialog.className = 'dashjs-native-modal'
  if (options.width) dialog.style.width = `${options.width}px`

  const header = document.createElement('div')
  header.className = 'dashjs-native-modal__header'
  header.innerHTML = `
    <span class="dashjs-native-modal__title">${options.title}</span>
    <button class="dashjs-native-modal__close" aria-label="Close">&times;</button>
  `

  const content = document.createElement('div')
  content.className = 'dashjs-native-modal__content'
  if (typeof options.body === 'string') {
    content.innerHTML = options.body
  } else {
    content.appendChild(options.body)
  }

  dialog.appendChild(header)
  dialog.appendChild(content)
  overlay.appendChild(dialog)
  document.body.appendChild(overlay)

  // Force reflow then add visible class for CSS transition.
  requestAnimationFrame(() => overlay.classList.add('is-visible'))

  const close = () => {
    overlay.classList.remove('is-visible')
    overlay.addEventListener('transitionend', () => {
      options.onClose?.()
      overlay.remove()
    }, { once: true })
  }

  header.querySelector('.dashjs-native-modal__close')!
    .addEventListener('click', close)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close()
  })

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey) }
  })

  return { close, el: content }
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
