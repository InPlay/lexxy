import Lexxy from "../config/lexxy"
import { $getEditor, $getNearestRootOrShadowRoot, DecoratorNode } from "lexical"
import { createAttachmentFigure, createElement, isPreviewableImage } from "../helpers/html_helper"
import { bytesToHumanSize, extractFileName } from "../helpers/storage_helper"
import { parseBoolean } from "../helpers/string_helper"

const ALIGNMENT_VALUES = [ "left", "center", "right" ]

const ALIGNMENT_ICONS = {
  left: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="9" height="2" rx="1"/><rect x="1" y="12" width="11" height="2" rx="1"/></svg>`,
  center: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="3.5" y="7" width="9" height="2" rx="1"/><rect x="2.5" y="12" width="11" height="2" rx="1"/></svg>`,
  right: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="6" y="7" width="9" height="2" rx="1"/><rect x="4" y="12" width="11" height="2" rx="1"/></svg>`,
}

export class ActionTextAttachmentNode extends DecoratorNode {
  static getType() {
    return "action_text_attachment"
  }

  static clone(node) {
    return new ActionTextAttachmentNode({ ...node }, node.__key)
  }

  static importJSON(serializedNode) {
    return new ActionTextAttachmentNode({ ...serializedNode })
  }

  static importDOM() {
    return {
      [this.TAG_NAME]: () => {
        return {
          conversion: (attachment) => ({
            node: new ActionTextAttachmentNode({
              sgid: attachment.getAttribute("sgid"),
              src: attachment.getAttribute("url"),
              previewable: attachment.getAttribute("previewable"),
              altText: attachment.getAttribute("alt"),
              caption: attachment.getAttribute("caption"),
              contentType: attachment.getAttribute("content-type"),
              fileName: attachment.getAttribute("filename"),
              fileSize: attachment.getAttribute("filesize"),
              width: attachment.getAttribute("width"),
              height: attachment.getAttribute("height"),
              alignment: attachment.getAttribute("data-alignment"),
            })
          }), priority: 1
        }
      },
      "img": () => {
        return {
          conversion: (img) => {
            const fileName = extractFileName(img.getAttribute("src") ?? "")
            return {
              node: new ActionTextAttachmentNode({
                src: img.getAttribute("src"),
                fileName: fileName,
                caption: img.getAttribute("alt") || "",
                contentType: "image/*",
                width: img.getAttribute("width"),
                height: img.getAttribute("height")
              })
            }
          }, priority: 1
        }
      },
      "video": () => {
        return {
          conversion: (video) => {
            const videoSource = video.getAttribute("src") || video.querySelector("source")?.src
            const fileName = videoSource?.split("/")?.pop()
            const contentType = video.querySelector("source")?.getAttribute("content-type") || "video/*"

            return {
              node: new ActionTextAttachmentNode({
                src: videoSource,
                fileName: fileName,
                contentType: contentType
              })
            }
          }, priority: 1
        }
      }
    }
  }

  static get TAG_NAME() {
    return Lexxy.global.get("attachmentTagName")
  }

  constructor({ tagName, sgid, src, previewable, altText, caption, contentType, fileName, fileSize, width, height, alignment }, key) {
    super(key)

    this.tagName = tagName || ActionTextAttachmentNode.TAG_NAME
    this.sgid = sgid
    this.src = src
    this.previewable = parseBoolean(previewable)
    this.altText = altText || ""
    this.caption = caption || ""
    this.contentType = contentType || ""
    this.fileName = fileName || ""
    this.fileSize = fileSize
    this.width = width
    this.height = height
    this.alignment = ALIGNMENT_VALUES.includes(alignment) ? alignment : null

    this.editor = $getEditor()
  }

  createDOM() {
    const figure = this.createAttachmentFigure()

    if (this.isPreviewableAttachment) {
      figure.appendChild(this.#createDOMForImage())
      figure.appendChild(this.#createCaptionDisplay())
    } else {
      figure.appendChild(this.#createDOMForFile())
      figure.appendChild(this.#createDOMForNotImage())
    }

    return figure
  }

  updateDOM(prevNode, dom) {
    if (prevNode.caption !== this.caption) {
      const captionEl = dom.querySelector("figcaption.attachment__caption--display")
      if (captionEl) captionEl.textContent = this.caption
    }

    if (prevNode.alignment !== this.alignment) {
      ALIGNMENT_VALUES.forEach(a => dom.classList.remove(`attachment--align-${a}`))
      if (this.alignment) dom.classList.add(`attachment--align-${this.alignment}`)
      this.#updateAlignmentButtons(dom, this.alignment)
    }

    if (prevNode.width !== this.width) {
      const img = dom.querySelector("img")
      if (img) {
        if (this.width) {
          img.style.width = `${this.width}px`
          img.style.maxWidth = "none"
        } else {
          img.style.width = ""
          img.style.maxWidth = ""
        }
      }
    }

    return false
  }

  getTextContent() {
    return `[${this.caption || this.fileName}]\n\n`
  }

  isInline() {
    return this.isAttached() && !this.getParent().is($getNearestRootOrShadowRoot(this))
  }

  exportDOM() {
    const attachment = createElement(this.tagName, {
      sgid: this.sgid,
      previewable: this.previewable || null,
      url: this.src,
      alt: this.altText,
      caption: this.caption,
      "content-type": this.contentType,
      filename: this.fileName,
      filesize: this.fileSize,
      width: this.width,
      height: this.height,
      "data-alignment": this.alignment || null,
      presentation: "gallery"
    })

    return { element: attachment }
  }

  exportJSON() {
    return {
      type: "action_text_attachment",
      version: 1,
      tagName: this.tagName,
      sgid: this.sgid,
      src: this.src,
      previewable: this.previewable,
      altText: this.altText,
      caption: this.caption,
      contentType: this.contentType,
      fileName: this.fileName,
      fileSize: this.fileSize,
      width: this.width,
      height: this.height,
      alignment: this.alignment
    }
  }

  decorate() {
    return null
  }

  createAttachmentFigure(previewable = this.isPreviewableAttachment) {
    const figure = createAttachmentFigure(this.contentType, previewable, this.fileName)
    figure.draggable = true
    figure.dataset.lexicalNodeKey = this.__key

    if (this.alignment) figure.classList.add(`attachment--align-${this.alignment}`)

    const deleteButton = createElement("lexxy-node-delete-button")
    figure.appendChild(deleteButton)

    if (this.isPreviewableAttachment) {
      figure.appendChild(this.#createAlignmentControls(figure))
    }

    return figure
  }

  get isPreviewableAttachment() {
    return this.isPreviewableImage || this.previewable
  }

  get isPreviewableImage() {
    return isPreviewableImage(this.contentType)
  }

  #createDOMForImage(options = {}) {
    const img = createElement("img", { src: this.src, draggable: false, alt: this.altText, ...options })

    // Use style.width instead of the width attribute — lexxy-content.css applies
    // `inline-size: auto` to all imgs which overrides the HTML width attribute.
    if (this.width) {
      img.style.width = `${this.width}px`
      img.style.maxWidth = "none"
    }

    if (this.previewable && !this.isPreviewableImage) {
      img.onerror = () => this.#swapPreviewToFileDOM(img)
    }

    const container = createElement("div", { className: "attachment__container" })
    container.appendChild(img)
    container.appendChild(this.#createResizeHandle(img))
    return container
  }

  #createAlignmentControls(figure) {
    const controls = createElement("div", { className: "lexxy-floating-controls attachment__alignment-controls" })
    const group = createElement("div", { className: "lexxy-floating-controls__group" })

    for (const value of ALIGNMENT_VALUES) {
      const btn = createElement("button", { type: "button", title: `Align ${value}` })
      btn.innerHTML = ALIGNMENT_ICONS[value]
      btn.dataset.alignment = value
      if (this.alignment === value) btn.setAttribute("aria-pressed", "true")

      btn.addEventListener("click", (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.editor.update(() => {
          const current = this.getLatest()
          const newAlignment = current.alignment === value ? null : value
          current.getWritable().alignment = newAlignment
        }, { discrete: true })
      })

      group.appendChild(btn)
    }

    const divider = createElement("div", { className: "lexxy-floating-controls__divider" })
    group.appendChild(divider)

    const captionBtn = createElement("button", { type: "button", title: "Edit caption" })
    captionBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="2" rx="1"/><rect x="6.5" y="4" width="3" height="10" rx="1"/></svg>`

    captionBtn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      let currentCaption = ""
      this.editor.getEditorState().read(() => { currentCaption = this.getLatest().caption })
      const result = prompt("Caption", currentCaption)
      if (result === null) return
      this.editor.update(() => {
        this.getLatest().getWritable().caption = result
      }, { discrete: true })
    })

    group.appendChild(captionBtn)
    controls.appendChild(group)
    return controls
  }

  #updateAlignmentButtons(dom, alignment) {
    dom.querySelectorAll(".attachment__alignment-controls button").forEach(btn => {
      btn.setAttribute("aria-pressed", (btn.dataset.alignment === alignment).toString())
    })
  }

  #createResizeHandle(img) {
    const handle = createElement("div", { className: "attachment__resize-handle" })
    let startX, startWidth

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      startX = e.clientX
      startWidth = img.offsetWidth

      const onMove = (moveEvent) => {
        const delta = moveEvent.clientX - startX
        const newWidth = Math.max(80, startWidth + delta)
        img.style.width = `${newWidth}px`
        img.style.height = "auto"
      }

      const onUp = () => {
        const finalWidth = parseInt(img.style.width, 10) || img.offsetWidth
        // Remove inline style — let the width attribute take over
        img.style.width = ""
        this.editor.update(() => {
          const writable = this.getWritable()
          writable.width = finalWidth
          writable.height = null // let browser compute from aspect ratio
        }, { discrete: true })
        handle.releasePointerCapture(e.pointerId)
        handle.removeEventListener("pointermove", onMove)
        handle.removeEventListener("pointerup", onUp)
      }

      handle.setPointerCapture(e.pointerId)
      handle.addEventListener("pointermove", onMove)
      handle.addEventListener("pointerup", onUp)
    })

    return handle
  }

  #swapPreviewToFileDOM(img) {
    const figure = img.closest("figure.attachment")
    if (!figure) return

    figure.className = figure.className.replace("attachment--preview", "attachment--file")

    const container = figure.querySelector(".attachment__container")
    if (container) container.remove()

    const caption = figure.querySelector("figcaption")
    if (caption) caption.remove()

    figure.appendChild(this.#createDOMForFile())
    figure.appendChild(this.#createDOMForNotImage())
  }

  get #imageDimensions() {
    const dims = {}
    if (this.width) dims.width = this.width
    if (this.height) dims.height = this.height
    return dims
  }

  #createCaptionDisplay() {
    return createElement("figcaption", {
      className: "attachment__caption attachment__caption--display",
      textContent: this.caption
    })
  }

  #createDOMForFile() {
    const extension = this.fileName ? this.fileName.split(".").pop().toLowerCase() : "unknown"
    return createElement("span", { className: "attachment__icon", textContent: `${extension}` })
  }

  #createDOMForNotImage() {
    const figcaption = createElement("figcaption", { className: "attachment__caption" })

    const nameTag = createElement("strong", { className: "attachment__name", textContent: this.caption || this.fileName })

    figcaption.appendChild(nameTag)

    if (this.fileSize) {
      const sizeSpan = createElement("span", { className: "attachment__size", textContent: bytesToHumanSize(this.fileSize) })
      figcaption.appendChild(sizeSpan)
    }

    return figcaption
  }

}

export function $createActionTextAttachmentNode(...args) {
  return new ActionTextAttachmentNode(...args)
}

export function $isActionTextAttachmentNode(node) {
  return node instanceof ActionTextAttachmentNode
}
