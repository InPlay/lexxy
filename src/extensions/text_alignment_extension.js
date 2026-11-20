import { $getSelection, $isElementNode, $isRangeSelection, $isRootOrShadowRoot, COMMAND_PRIORITY_NORMAL, FORMAT_ELEMENT_COMMAND, defineExtension } from "lexical"
import { $findMatchingParent, mergeRegister } from "@lexical/utils"
import LexxyExtension from "./lexxy_extension"

const ALIGNMENT_COMMANDS = {
  alignLeft: "left",
  alignCenter: "center",
  alignRight: "right",
  alignJustify: "justify"
}

const ALIGNMENTS = Object.values(ALIGNMENT_COMMANDS)

export class TextAlignmentExtension extends LexxyExtension {
  get enabled() {
    return this.editorElement.supportsRichText
  }

  get allowedStyles() {
    return [ { property: "text-align", values: ALIGNMENTS } ]
  }

  get lexicalExtension() {
    return defineExtension({
      name: "lexxy/text-alignment",
      register: (editor) => mergeRegister(
        ...Object.entries(ALIGNMENT_COMMANDS).map(([ command, alignment ]) =>
          editor.registerCommand(command, () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment), COMMAND_PRIORITY_NORMAL)
        ),
        editor.registerUpdateListener(({ editorState }) => editorState.read(() => this.#updateButtonStates()))
      )
    })
  }

  #updateButtonStates() {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return

    const alignment = $blockAlignment(selection.anchor.getNode())
    for (const value of ALIGNMENTS) {
      const button = this.editorElement.toolbar?.querySelector(`[name="align-${value}"]`)
      if (button) button.ariaPressed = value === alignment
    }
  }
}

function $blockAlignment(node) {
  const block = $findMatchingParent(node, (parent) => $isElementNode(parent) && !parent.isInline() && !$isRootOrShadowRoot(parent))
  return block?.getFormatType() || "left"
}
