/**
 * Tiny DOM toolkit shared by the YouTube overlay and the extension pages.
 * Never uses innerHTML (YouTube enforces Trusted Types; it also keeps subtitle text inert).
 */
;(() => {
  const LEATCH = (globalThis.LEATCH ||= {})
  const SVG_NS = 'http://www.w3.org/2000/svg'

  /** Stroke icons (24×24 grid), described as [tag, attributes] pairs. */
  const ICONS = {
    speaker: [['polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }], ['path', { d: 'M15.54 8.46a5 5 0 0 1 0 7.07' }], ['path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14' }]],
    star: [['polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' }]],
    play: [['polygon', { points: '6 3 20 12 6 21 6 3' }]],
    replay: [['path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }], ['path', { d: 'M3 3v5h5' }]],
    prev: [['polygon', { points: '19 20 9 12 19 4 19 20' }], ['line', { x1: 5, x2: 5, y1: 19, y2: 5 }]],
    next: [['polygon', { points: '5 4 15 12 5 20 5 4' }], ['line', { x1: 19, x2: 19, y1: 5, y2: 19 }]],
    bookmark: [['path', { d: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' }]],
    sliders: [
      ['line', { x1: 21, x2: 14, y1: 4, y2: 4 }], ['line', { x1: 10, x2: 3, y1: 4, y2: 4 }],
      ['line', { x1: 21, x2: 12, y1: 12, y2: 12 }], ['line', { x1: 8, x2: 3, y1: 12, y2: 12 }],
      ['line', { x1: 21, x2: 16, y1: 20, y2: 20 }], ['line', { x1: 12, x2: 3, y1: 20, y2: 20 }],
      ['line', { x1: 14, x2: 14, y1: 2, y2: 6 }], ['line', { x1: 8, x2: 8, y1: 10, y2: 14 }], ['line', { x1: 16, x2: 16, y1: 18, y2: 22 }],
    ],
    captions: [['rect', { width: 18, height: 14, x: 3, y: 5, rx: 2 }], ['path', { d: 'M7 15h4M15 15h2M7 11h2M13 11h4' }]],
    book: [['path', { d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' }], ['path', { d: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }]],
    pause: [['circle', { cx: 12, cy: 12, r: 10 }], ['line', { x1: 10, x2: 10, y1: 15, y2: 9 }], ['line', { x1: 14, x2: 14, y1: 15, y2: 9 }]],
    close: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
    pen: [['path', { d: 'M12 20h9' }], ['path', { d: 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z' }]],
    library: [['path', { d: 'm16 6 4 14' }], ['path', { d: 'M12 6v14' }], ['path', { d: 'M8 8v12' }], ['path', { d: 'M4 4v16' }]],
    trash: [['path', { d: 'M3 6h18' }], ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }], ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }]],
    swap: [['path', { d: 'm16 3 4 4-4 4' }], ['path', { d: 'M20 7H4' }], ['path', { d: 'm8 21-4-4 4-4' }], ['path', { d: 'M4 17h16' }]],
    external: [['path', { d: 'M15 3h6v6' }], ['path', { d: 'M10 14 21 3' }], ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }]],
    sparkles: [['path', { d: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' }], ['path', { d: 'M19 17v4M17 19h4' }]],
  }

  /**
   * Creates an SVG icon element.
   *
   * @param {keyof ICONS} name
   * @param {{ size?: number, filled?: boolean }} [options]
   * @returns {SVGElement}
   */
  const icon = (name, { size = 18, filled = false } = {}) => {
    const svg = document.createElementNS(SVG_NS, 'svg')
    const attributes = {
      viewBox: '0 0 24 24', width: size, height: size, fill: filled ? 'currentColor' : 'none', stroke: 'currentColor',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
    }
    Object.entries(attributes).forEach(([key, value]) => svg.setAttribute(key, String(value)))
    for (const [tag, attrs] of ICONS[name] || []) {
      const child = document.createElementNS(SVG_NS, tag)
      Object.entries(attrs).forEach(([key, value]) => child.setAttribute(key, String(value)))
      svg.append(child)
    }
    return svg
  }

  const append = (element, children) => {
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false) return
      element.append(child instanceof Node ? child : document.createTextNode(String(child)))
    })
    return element
  }

  /**
   * Hyperscript-style element factory.
   *
   * @param {string} tag
   * @param {object} [props] - attributes; `class`, `text`, `dataset`, `style` (object) and `onX` listeners are special
   * @param {...(Node|string|Array)} children
   * @returns {HTMLElement}
   */
  const h = (tag, props = {}, ...children) => {
    const element = document.createElement(tag)
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue
      if (key === 'class') element.className = value
      else if (key === 'text') element.textContent = value
      else if (key === 'dataset') Object.assign(element.dataset, value)
      else if (key === 'style' && typeof value === 'object') Object.assign(element.style, value)
      else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.slice(2).toLowerCase(), value)
      else if (key === 'value') element.value = value
      else if (key === 'checked' || key === 'selected' || key === 'disabled') element[key] = Boolean(value)
      else element.setAttribute(key, value === true ? '' : String(value))
    }
    return append(element, children)
  }

  const clear = (element) => {
    while (element.firstChild) element.firstChild.remove()
    return element
  }

  /** Icon-only button with an accessible label. */
  const iconButton = (name, title, onClick, { cls = '', filled = false, size } = {}) =>
    h('button', { class: `lt-icon-btn ${cls}`.trim(), type: 'button', title, 'aria-label': title, onClick }, icon(name, { filled, size }))

  /**
   * Splits `text` into text nodes and <mark> elements for each item's `surface`.
   *
   * @param {string} text
   * @param {Array<{ surface?: string, type?: string }>} items
   * @param {(item: object, index: number) => void} [onClick]
   * @returns {Array<Node>}
   */
  const highlight = (text, items = [], onClick) => {
    const ranges = []
    items.forEach((item, index) => {
      if (!item.surface) return
      let from = 0
      while (from <= text.length) {
        const start = text.indexOf(item.surface, from)
        if (start < 0) return
        const end = start + item.surface.length
        if (!ranges.some((range) => start < range.end && end > range.start)) {
          ranges.push({ start, end, item, index })
          return
        }
        from = start + 1
      }
    })
    ranges.sort((a, b) => a.start - b.start)

    const nodes = []
    let cursor = 0
    for (const range of ranges) {
      if (range.start > cursor) nodes.push(document.createTextNode(text.slice(cursor, range.start)))
      nodes.push(
        h('mark', {
          class: 'lt-hl',
          dataset: { type: range.item.type || 'vocab', index: String(range.index) },
          title: range.item.meaning || '',
          onClick: onClick ? () => onClick(range.item, range.index) : undefined,
        }, text.slice(range.start, range.end)),
      )
      cursor = range.end
    }
    if (cursor < text.length) nodes.push(document.createTextNode(text.slice(cursor)))
    return nodes
  }

  LEATCH.dom = { h, icon, clear, append, iconButton, highlight }
})()
