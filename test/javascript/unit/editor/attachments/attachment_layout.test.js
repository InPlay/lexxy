import { afterAll, afterEach, beforeAll, expect, test } from "vitest"
import Lexxy from "src/config/lexxy"
import { AttachmentLayoutExtension } from "src/extensions/attachment_layout_extension"
import { createTestEditor, destroyTestEditor } from "../../helpers/editor_helper"

let previousExtensions, editorElement

beforeAll(() => {
  previousExtensions = Lexxy.global.get("extensions")
  Lexxy.configure({ global: { extensions: [ AttachmentLayoutExtension ] } })
})

afterAll(() => {
  Lexxy.configure({ global: { extensions: previousExtensions } })
})

afterEach(async () => {
  await destroyTestEditor(editorElement)
})

function image(n, attributes = "") {
  return `<action-text-attachment sgid="sgid${n}" content-type="image/png" url="https://example.com/${n}.png" filename="${n}.png" previewable="true" ${attributes}></action-text-attachment>`
}

function exportedAttachment(n) {
  const document = new DOMParser().parseFromString(editorElement.value, "text/html")
  return document.querySelector(`action-text-attachment[sgid="sgid${n}"]`)
}

test("an image keeps its alignment and width, and one without an alignment saves as centered", async () => {
  editorElement = await createTestEditor({ value: `${image(1, 'width="300" data-alignment="left"')}<p>Text</p>${image(2)}<p>Text</p>${image(3, 'content="" data-alignment="right"')}` })

  expect(exportedAttachment(1).getAttribute("data-alignment")).toBe("left")
  expect(exportedAttachment(1).getAttribute("width")).toBe("300")
  expect(exportedAttachment(2).getAttribute("data-alignment")).toBe("center")
  expect(exportedAttachment(3).getAttribute("data-alignment")).toBe("right")
})

test("an image in a gallery saves no alignment", async () => {
  editorElement = await createTestEditor({ value: `<div>${image(1, 'data-alignment="right"')}${image(2)}</div>` })

  expect(editorElement.querySelector(".attachment-gallery")).not.toBeNull()
  expect(exportedAttachment(1).hasAttribute("data-alignment")).toBe(false)
  expect(exportedAttachment(2).hasAttribute("data-alignment")).toBe(false)
})
