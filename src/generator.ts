import type { CoercedType, ResolvedFieldType } from "varlock/plugin-lib"

function type(coerced: CoercedType): string {
  if (coerced === "string") return "string"
  if (coerced === "int" || coerced === "number") return "number"
  if (coerced === "boolean") return "boolean"
  if (coerced === "object") return "Record<string, unknown>"

  if ("enum" in coerced) {
    return coerced.enum.map((member) => JSON.stringify(member)).join(" | ")
  }

  if ("arrayOf" in coerced) return `Array<${type(coerced.arrayOf)}>`

  const value = coerced.recordOf.values
    ? type(coerced.recordOf.values)
    : "unknown"
  const keys = coerced.recordOf.keys

  if (keys && typeof keys === "object" && "enum" in keys) {
    const key = keys.enum.map((member) => JSON.stringify(member)).join(" | ")
    return `Partial<Record<${key}, ${value}>>`
  }

  return `Record<string, ${value}>`
}

function composite(coerced: CoercedType): boolean {
  return coerced === "object"
    || (typeof coerced === "object" && ("arrayOf" in coerced || "recordOf" in coerced))
}

function value(field: ResolvedFieldType): string {
  const name = JSON.stringify(field.key)
  const coerced = field.coerced

  let config: string

  if (coerced === "string") config = `Config.string(${name})`
  else if (coerced === "boolean") config = `Config.boolean(${name})`
  else if (coerced === "int") config = `Config.integer(${name})`
  else if (coerced === "number") config = `Config.number(${name})`
  else if (typeof coerced === "object" && "enum" in coerced) {
    if (coerced.enum.length === 0) {
      throw new Error(`Effect Config generation requires at least one enum value for ${name}`)
    }

    const members = coerced.enum.map((member) => JSON.stringify(member)).join(", ")
    config = `Config.literal(${members})(${name})`
  } else if (composite(coerced)) {
    config = `Config.mapAttempt(Config.string(${name}), (value) => JSON.parse(value) as ${type(coerced)})`
  } else {
    throw new Error(`Unsupported Varlock coerced type: ${JSON.stringify(coerced)}`)
  }

  if (field.isSensitive) config = `Config.redacted(${config})`
  if (!field.isRequired) config = `Config.option(${config})`

  return config
}

function comments(field: ResolvedFieldType): Array<string> {
  const lines: Array<string> = []

  if (field.docs.description) {
    lines.push(...field.docs.description.split(/\r\n|\r|\n/))
  }

  for (const link of field.docs.docsLinks) {
    lines.push(`Docs: ${[link.url, link.description].filter(Boolean).join(" | ")}`)
  }

  if (field.docs.isDeprecated) {
    lines.push(field.docs.deprecationMessage
      ? `@deprecated ${field.docs.deprecationMessage}`
      : "@deprecated")
  }

  return lines.map((line) => line.replaceAll("*/", "* /").replace(/[\u0000-\u001f]/g, " ").trimEnd())
}

function property(field: ResolvedFieldType): string {
  const docs = comments(field)
  const comment = docs.length === 0
    ? ""
    : `  /**\n${docs.map((line) => `   * ${line}`).join("\n")}\n   */\n`

  return `${comment}  ${JSON.stringify(field.key)}: ${value(field)},`
}

export function generateEffectConfig(fields: Array<ResolvedFieldType>): string {
  return `/**
 * Generated from .env.schema by Varlock. Do not edit by hand.
 */
import * as Config from "effect/Config"

export const generated = Config.all({
${fields.map(property).join("\n")}
})
`
}
