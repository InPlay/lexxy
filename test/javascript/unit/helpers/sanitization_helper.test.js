import { expect, test } from "vitest"
import { sanitize } from "src/helpers/sanitization_helper"

test("keeps text-align so paragraph alignment survives save", () => {
  expect(sanitize(`<p style="text-align: center;">Centered</p>`))
    .toContain("text-align: center")
  expect(sanitize(`<p style="text-align: right;">Right</p>`))
    .toContain("text-align: right")
  expect(sanitize(`<p style="text-align: justify;">Justified</p>`))
    .toContain("text-align: justify")
})

test("still keeps the previously-allowed color properties", () => {
  const out = sanitize(`<p style="color: red; background-color: yellow;">x</p>`)
  expect(out).toContain("color: red")
  expect(out).toContain("background-color: yellow")
})

test("still strips a disallowed style property", () => {
  expect(sanitize(`<p style="position: fixed;">x</p>`)).not.toContain("position")
})
