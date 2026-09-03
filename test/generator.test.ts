import type { ResolvedFieldType } from "varlock/plugin-lib"
import { describe, expect, test } from "vitest"

import { generateEffectConfig } from "../src/generator.js"

function field(overrides: Partial<ResolvedFieldType> & Pick<ResolvedFieldType, "key">): ResolvedFieldType {
  return {
    coerced: "string",
    isRequired: true,
    isSensitive: false,
    docs: {
      isDeprecated: false,
      docsLinks: [],
    },
    ...overrides,
  }
}

describe("generateEffectConfig", () => {
  test("generates Effect Configs for scalar and enum fields", () => {
    const source = generateEffectConfig([
      field({ key: "NAME" }),
      field({ key: "ENABLED", coerced: "boolean" }),
      field({ key: "PORT", coerced: "int" }),
      field({ key: "RATIO", coerced: "number" }),
      field({ key: "STAGE", coerced: { enum: ["dev", "prod"] } }),
    ])

    expect(source).toContain('"NAME": Config.string("NAME")')
    expect(source).toContain('"ENABLED": Config.boolean("ENABLED")')
    expect(source).toContain('"PORT": Config.integer("PORT")')
    expect(source).toContain('"RATIO": Config.number("RATIO")')
    expect(source).toContain('"STAGE": Config.literal("dev", "prod")("STAGE")')
  })

  test("preserves sensitive and optional semantics", () => {
    const source = generateEffectConfig([
      field({
        key: "TOKEN",
        isRequired: false,
        isSensitive: true,
      }),
    ])

    expect(source).toContain(
      '"TOKEN": Config.option(Config.redacted(Config.string("TOKEN")))',
    )
  })

  test("parses Varlock composite values from their JSON wire format", () => {
    const source = generateEffectConfig([
      field({ key: "HOSTS", coerced: { arrayOf: "string" } }),
      field({
        key: "LIMITS",
        coerced: {
          recordOf: {
            keys: { enum: ["us", "eu"] },
            values: "int",
          },
        },
      }),
      field({ key: "DATA", coerced: "object" }),
    ])

    expect(source).toContain(
      'JSON.parse(value) as Array<string>',
    )
    expect(source).toContain(
      'JSON.parse(value) as Partial<Record<"us" | "eu", number>>',
    )
    expect(source).toContain(
      'JSON.parse(value) as Record<string, unknown>',
    )
  })

  test("emits safe multiline documentation", () => {
    const source = generateEffectConfig([
      field({
        key: "OLD_KEY",
        docs: {
          description: "First line\ncloses */ comment",
          docsLinks: [{ url: "https://example.com", description: "Reference" }],
          isDeprecated: true,
          deprecationMessage: "Use NEW_KEY",
        },
      }),
    ])

    expect(source).toContain("* First line")
    expect(source).toContain("* closes * / comment")
    expect(source).toContain("* Docs: https://example.com | Reference")
    expect(source).toContain("* @deprecated Use NEW_KEY")
  })

  test("rejects empty enums", () => {
    expect(() => generateEffectConfig([
      field({ key: "EMPTY", coerced: { enum: [] } }),
    ])).toThrow("requires at least one enum value")
  })
})
