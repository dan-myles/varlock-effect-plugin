# varlock-effect-plugin

Generate an [Effect Config](https://effect.website/docs/configuration/) module from a
[Varlock](https://varlock.dev/) environment schema.

## Install

Install the plugin in the workspace that owns `.env.schema`. The generated module imports
`effect/Config`, so that workspace must also depend on Effect.

```sh
bun add -d varlock-effect-plugin
bun add effect
```

## Configure

```dotenv
# @plugin(varlock-effect-plugin)
# @generateEffectConfig(path=./src/env.generated.ts)
# ---
# @type=enum(development, staging, production) @public
APP_ENV=development

# @type=port @public
PORT=3000

# @sensitive
API_TOKEN=
```

Generate the module explicitly:

```sh
bunx varlock codegen
```

Varlock also regenerates it during `varlock load` and `varlock run` unless the decorator uses
`auto=false`.

## Use

```ts
import { Effect } from "effect"

import { generated } from "./env.generated.js"

const program = Effect.gen(function* () {
  const env = yield* generated

  console.log(env.APP_ENV)
})

Effect.runPromise(program)
```

Run the application through Varlock so it validates and injects the environment first:

```sh
bunx varlock run -- bun run src/index.ts
```

The generator maps Varlock values to Effect as follows:

| Varlock schema | Generated Effect Config |
| --- | --- |
| string-like values | `Config.string` |
| boolean | `Config.boolean` |
| int | `Config.integer` |
| number | `Config.number` |
| enum | `Config.literal` |
| array, record, object | JSON parsed `Config.string` |
| `@sensitive` | `Config.redacted` |
| optional | `Config.option` |

Composite values are parsed from Varlock's serialized JSON wire format. Varlock remains responsible
for schema validation before it injects those values.

## Local development

```sh
bun install
bun run check
```

## Publish

Sign in to npm once:

```sh
npm login
npm whoami
```

Then publish:

```sh
bun run release
```

The `prepublishOnly` hook runs typechecking, tests, and the production build before npm uploads the
package. npm refuses to overwrite an existing version, so bump `version` in `package.json` before
later releases.

## License

MIT
