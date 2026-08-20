import { describe, it, expect } from "vitest"
import { APP_BUILD, versionLabel, versionDetail } from "@/lib/version"

describe("build stamp", () => {
  it("is available to tests via the mirrored define block", () => {
    expect(APP_BUILD.version).toBe("0.0.0-test")
    expect(versionLabel).toBe("v0.0.0-test · build 0")
    expect(versionDetail()).toContain("Commit test")
  })
})
