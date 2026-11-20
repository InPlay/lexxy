import { $getNodeByKey, $getState, $setState, createState, defineExtension } from "lexical"
import { ActionTextAttachmentNode } from "../nodes/action_text_attachment_node"
import { $isImageGalleryNode } from "../nodes/image_gallery_node"
import { createElement } from "../helpers/html_helper"
import { extendConversion } from "../helpers/lexical_helper"
import LexxyExtension from "./lexxy_extension"

const ALIGNMENTS = [ "left", "center", "right" ]
const MIN_WIDTH = 80

const ALIGNMENT_ICONS = {
  left: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><rect x=\"1\" y=\"2\" width=\"14\" height=\"2\" rx=\"1\"/><rect x=\"1\" y=\"7\" width=\"9\" height=\"2\" rx=\"1\"/><rect x=\"1\" y=\"12\" width=\"11\" height=\"2\" rx=\"1\"/></svg>",
  center: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><rect x=\"1\" y=\"2\" width=\"14\" height=\"2\" rx=\"1\"/><rect x=\"3.5\" y=\"7\" width=\"9\" height=\"2\" rx=\"1\"/><rect x=\"2.5\" y=\"12\" width=\"11\" height=\"2\" rx=\"1\"/></svg>",
  right: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\"><rect x=\"1\" y=\"2\" width=\"14\" height=\"2\" rx=\"1\"/><rect x=\"6\" y=\"7\" width=\"9\" height=\"2\" rx=\"1\"/><rect x=\"4\" y=\"12\" width=\"11\" height=\"2\" rx=\"1\"/></svg>"
}

const alignmentState = createState("alignment", {
  parse: (value) => {
    if (ALIGNMENTS.includes(value)) {
      return value
    } else {
      return "center"
    }
  }
})

export class AttachmentLayoutExtension extends LexxyExtension {
  #domListeners = new AbortController()

  get enabled() {
    return this.editorElement.supportsAttachments
  }

  get allowedElements() {
    return [ { tag: ActionTextAttachmentNode.TAG_NAME, attributes: [ "data-alignment" ] } ]
  }

  get lexicalExtension() {
    return defineExtension({
      name: "lexxy/attachment-layout",
      html: {
        import: { [ActionTextAttachmentNode.TAG_NAME]: alignedAttachmentConversion },
        export: new Map([ [ ActionTextAttachmentNode, $exportAttachmentWithAlignment ] ])
      },
      register: (editor) => editor.registerMutationListener(ActionTextAttachmentNode, (mutations) => {
        editor.getEditorState().read(() => this.#layOutAttachments(editor, mutations), { editor })
      })
    })
  }

  dispose() {
    this.#domListeners.abort()
  }

  #layOutAttachments(editor, mutations) {
    for (const [ key, mutation ] of mutations) {
      const figure = editor.getElementByKey(key)
      if (mutation !== "destroyed" && figure) {
        this.#layOutAttachment(editor, figure, $getNodeByKey(key))
      }
    }
  }

  #layOutAttachment(editor, figure, node) {
    const image = figure.querySelector(".attachment__container > img")

    if (image && node.isPreviewableImage && !$isImageGalleryNode(node.getParent())) {
      this.#decorate(editor, figure, image, node)
    } else {
      undecorate(figure, image)
    }
  }

  #decorate(editor, figure, image, node) {
    const alignment = $getState(node, alignmentState)

    for (const value of ALIGNMENTS) {
      figure.classList.toggle(`attachment--align-${value}`, value === alignment)
    }

    if (node.width) {
      image.style.width = `${node.width}px`
    } else {
      image.style.width = ""
    }

    if (!image.parentElement.querySelector(":scope > .attachment__resize-handle")) {
      image.parentElement.append(this.#createResizeHandle(editor, image, node.getKey()))
    }

    if (!figure.querySelector(":scope > .attachment__alignment-controls")) {
      figure.prepend(this.#createAlignmentControls(editor, node.getKey()))
    }

    for (const button of figure.querySelectorAll(".attachment__alignment-controls button")) {
      button.ariaPressed = button.dataset.alignment === alignment
    }
  }

  #createResizeHandle(editor, image, key) {
    const handle = createElement("div", { className: "attachment__resize-handle" })

    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault()
      event.stopPropagation()

      const startX = event.clientX
      const startWidth = image.offsetWidth
      const startStyleWidth = image.style.width
      const drag = new AbortController()
      let width

      handle.setPointerCapture(event.pointerId)

      handle.addEventListener("pointermove", (moveEvent) => {
        width = Math.max(MIN_WIDTH, Math.round(startWidth + moveEvent.clientX - startX))
        image.style.width = `${width}px`
      }, { signal: drag.signal })

      handle.addEventListener("pointerup", () => {
        drag.abort()
        if (width) {
          resizeAttachment(editor, key, width)
        }
      }, { signal: drag.signal })

      handle.addEventListener("pointercancel", () => {
        drag.abort()
        image.style.width = startStyleWidth
      }, { signal: drag.signal })
    }, { signal: this.#domListeners.signal })

    return handle
  }

  #createAlignmentControls(editor, key) {
    const controls = createElement("div", { className: "lexxy-floating-controls attachment__alignment-controls" })
    const group = createElement("div", { className: "lexxy-floating-controls__group" })

    for (const alignment of ALIGNMENTS) {
      const button = createElement("button", { type: "button", title: `Align ${alignment}`, innerHTML: ALIGNMENT_ICONS[alignment] })
      button.dataset.alignment = alignment

      button.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        editor.update(() => $setState($getNodeByKey(key), alignmentState, alignment), { discrete: true })
      }, { signal: this.#domListeners.signal })

      group.append(button)
    }

    controls.append(group)
    return controls
  }
}

// Priority 2 outranks ActionTextAttachmentNode's own conversion. An attachment with
// content is CustomActionTextAttachmentNode's, which claims it at priority 2 as well.
function alignedAttachmentConversion(element) {
  if (element.hasAttribute("data-alignment") && !element.getAttribute("content")) {
    return {
      conversion: extendConversion(ActionTextAttachmentNode, ActionTextAttachmentNode.TAG_NAME, $applyAlignment),
      priority: 2
    }
  } else {
    return null
  }
}

function $applyAlignment({ node }, element) {
  $setState(node, alignmentState, alignmentState.parse(element.getAttribute("data-alignment")))
}

function $exportAttachmentWithAlignment(editor, node) {
  const output = node.exportDOM(editor)

  if (!$isImageGalleryNode(node.getParent())) {
    output.element.setAttribute("data-alignment", $getState(node, alignmentState))
  }

  return output
}

// Height is cleared rather than scaled: the stored attachment keeps only its
// width, and the browser derives the height from the image's aspect ratio.
function resizeAttachment(editor, key, width) {
  editor.update(() => {
    const node = $getNodeByKey(key).getWritable()
    node.width = width
    node.height = null
  }, { discrete: true })
}

function undecorate(figure, image) {
  for (const value of ALIGNMENTS) {
    figure.classList.remove(`attachment--align-${value}`)
  }

  image?.style.removeProperty("width")
  figure.querySelector(".attachment__resize-handle")?.remove()
  figure.querySelector(":scope > .attachment__alignment-controls")?.remove()
}
