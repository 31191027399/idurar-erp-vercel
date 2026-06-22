## Context

This codebase is IDURAR-pattern ERP: generic CRUD controllers auto-registered by globbing model files. Routes are accurate (a new model file auto-registers 9 routes), but the OpenAPI spec is hand-written and has drifted severely from the models. Worse, there are **three** sources of truth that disagree for any given entity:

```
Mongoose model (storage)   Joi schema (input gate, Invoice only)   Controller (runtime mutation)
        ✗ never compared              ✗ never compared                     │
                                                                                  ▼
                                                          OpenAPI (hand-written, drifted)
```

For Invoice alone: `currency` is required in the model, absent from Joi, and **deleted by the controller on update**. `paymentStatus` is computed by the controller from totals. `pdf` is server-set. The spec says none of this.

Stakeholders: external API consumers (need accurate spec), backend devs (need a single source of truth), CI (needs to block drift).

## Goals / Non-Goals

**Goals:**
- One authored source of truth per entity, co-located with its model
- OpenAPI schemas + Joi validators **generated** from that source — never hand-written, never drift
- Capture what's writable vs server-set (`readOnly`) vs immutable per operation
- Express cross-entity workflows (Payment→Invoice, Quote→Invoice via convert) as first-class operations
- CI fails on stale generated artifacts
- Migration is per-entity so the breaking change (`additionalProperties: false`) is graduated

**Non-Goals:**
- Refactoring controllers to stop mutating request bodies. The declarations *describe* the mutation; they don't *enforce* it. Future work.
- Frontend changes. Frontend already consumes the API; the spec is for external clients and docs.
- Migrating all six entities in this change. We migrate **Taxes end-to-end** as proof of the pipeline. The other five are follow-up changes following the same pattern.
- Non-CRUD routes outside entities (login, admin api-keys, settings-by-key). Those stay hand-written in `openapi/paths/*.yaml`.
- Runtime spec serving (`/openapi.json` introspecting models at boot). Build-time generation only, committed files.

## Decisions

### D1. Declarations live in sibling `*.openapi.js` files, not inside the model

**Choice:** `appModels/Taxes.js` (storage) + `appModels/Taxes.openapi.js` (contract), paired by basename.

**Rationale:** Co-located (same directory, same entity), but storage and contract don't fight for the same file. `Invoice.js` is already 179 lines; adding a 60-line declaration block would mix concerns. The glob in `models/utils/index.js` already globs `*.js` — it must learn to skip `*.openapi.js` so they don't get treated as models.

**Alternatives considered:**
- `schema.statics.openapi = {...}` inside the model file — rejected: mixes storage and API semantics in one file; harder to scan.
- Separate `openapi/entities/*.yaml` outside `models/` — rejected: loses co-location; two directories to keep in sync.

### D2. Generator walks `Model.schema.paths` + applies declaration overrides

**Choice:** Five-stage pipeline — LOAD → PAIR → RESOLVE → EMIT → ASSEMBLE.

```
inputs (authored truth)
  appModels/*.js                ← Mongoose models (unchanged)
  appModels/*.openapi.js        ← entity declarations (NEW)
  _components/*.openapi.js      ← shared sub-schemas (NEW)
  operations/*.openapi.js       ← named workflows (NEW)
  openapi/paths/*.yaml          ← hand-written operation docs (extracted from current spec)
        │
        ▼
scripts/gen-spec.js
        │
        ├──▶ openapi/build/schemas/*.yaml     ← generated components (4 faces per entity)
        ├──▶ <entity>Controller/schemaValidate.js  ← generated Joi (per entity)
        └──▶ openapi/build/idurar-erp.openapi.yaml  ← assembled final spec
```

**Rationale:** The Mongoose schema already encodes `type`, `required`, `enum`, `default`, `ref`. Re-declaring these in the `openapi.js` would create a new drift surface. Instead, the generator infers from the model and the declaration only overrides where intent diverges (e.g. marking a model-required field as `readOnly`, or documenting a string field as a percentage).

**Mongoose → JSON Schema type map:**
| Mongoose | OpenAPI |
|---|---|
| `String` | `{ type: string }` |
| `Number` | `{ type: number }` |
| `Boolean` | `{ type: boolean }` |
| `Date` | `{ type: string, format: date-time }` |
| `Schema.ObjectId` (no ref) | `{ type: string, format: objectid }` |
| `Schema.ObjectId` + `ref: 'X'` | per declaration `fields[x].input` / `.response` knobs |
| enum `[...]` | `{ enum: [...] }` |
| `required: true` | added to `required: [...]` array |
| `default: x` | `{ default: x }` |
| `[Subdoc]` | `{ type: array, items: {...} }` (recursively emit) |
| nested object | `{ type: object, properties: {...} }` (recursively emit) |
| `Schema.Types.Mixed` | `{ type: object }` (escape hatch; declaration overrides) |

**Four faces emitted per entity:**
- `<Entity>` — full storage shape (response). `readOnly` fields included with `readOnly: true`.
- `<Entity>Create` — `create.required ∪ create.optional`, minus `readOnly` and `ignore`. These are `writeOnly: true`.
- `<Entity>`Update — `(create − update.immutable) ∪ update.required`, all optional. Excludes `readOnly`.
- `<Entity>Response` — alias for `<Entity>`.

### D3. Refs are resolved per-face using declaration knobs

**Choice:** Each ref field's input vs response shape is declared explicitly:
```js
fields: {
  client:    { ref: 'Client',  input: 'id-or-object', response: 'populated' },
  createdBy: { ref: 'Admin',   input: 'readOnly',     response: 'id' },
  payment:   { ref: 'Payment', input: 'readOnly',     response: 'id-array' },
}
```

**Rationale:** A ref field has genuinely different shapes per direction. `client` on Invoice accepts an id OR an inline object on input (matches existing Joi `Joi.alternatives().try(string, object)`), and returns the full populated Client on response (model has `autopopulate: true`). The generator can't infer this — it must be declared.

### D4. Component registry for shared sub-schemas

**Choice:** `appModels/_components/LineItem.openapi.js` — no model file, no routes, just a reusable schema. Referenced via `$ref: 'LineItem'`.

**Rationale:** `items[]` is shared by Invoice and Quote. Inline-duplicating would reintroduce drift. The registry scales to `Address`, `Money`, `AuditFields`, `File`, etc. — shapes ERPs accumulate. Components are emitted to `openapi/build/schemas/` and `$ref`'d by entities.

### D5. Cross-entity operations are first-class declarations

**Choice:** `operations/paymentCreate.openapi.js` declares the workflow:
```js
module.exports = {
  operation: 'paymentCreate',
  method: 'POST',
  path: '/api/payment/create',
  requestBody: { $ref: 'PaymentCreate' },
  response: { $ref: 'Payment' },
  // The parts that can't be expressed as entity CRUD:
  validation: [
    { rule: 'amount > 0', description: 'Amount must be greater than zero.' },
    { rule: 'amount <= invoice.remainingBalance', description: 'Amount cannot exceed remaining balance.' },
  ],
  sideEffects: [
    { target: 'Invoice', op: 'update', fields: ['credit', 'payment', 'paymentStatus'] },
  ],
};
```

**Rationale:** Creating a Payment is a *transaction*, not CRUD. The declaration captures what the operation does (request/response shape, validation rules, side effects) in a structured, machine-readable form. The generator renders these into the OpenAPI `description` and `x-` extensions. Alternatives considered:
- **Prose `notes` only** — cheaper but lossy; clients can't introspect side effects.
- **Promote everything to operations, kill entity CRUD** — too much churn; CRUD is still valid for most entities.

### D6. Joi is generated from the same declaration (unified source)

**Choice:** `scripts/gen-spec.js` emits `<entity>Controller/schemaValidate.js` per entity. Existing hand-written `schemaValidate.js` (Invoice only) is replaced. For entities with no Joi today (Taxes, PaymentMode, Client, Payment, Quote), generation **introduces** validation.

**Rationale:** If Joi stays hand-written alongside the new declarations, drift returns immediately. Unifying is the only structural guarantee. The generated Joi mirrors `additionalProperties` — `stripUnknown`/`allowUnknown` set to match.

**Wiring for generic-controller entities:** Today's `createCRUDController` does no validation. The wiring options were:
- **(chosen)** Modify `createCRUDController` to optionally accept/load a per-entity Joi. If `schemaValidate.js` exists for the entity, validate before save; else fall through to today's behavior. Avoids creating empty controller folders per entity.
- Generate a thin custom controller per entity that wraps the generic. Rejected — empty folders, more files, obscures the "generic" path.

### D7. `additionalProperties` is per-entity, graduated

**Choice:** Each declaration sets `additionalProperties: true | false`. Default `true` (matches today's permissive behavior); entities explicitly marked `false` flip to strict. Migration order graduates entities one at a time.

**Rationale:** Flipping everything to strict at once is a sweeping breaking change. Per-entity lets us audit each entity's real clients before rejecting their extra fields. Taxes is small and well-understood → graduates to `false` immediately. Larger entities (Invoice) may stay `true` until audited.

### D8. Generated artifacts are committed to git

**Choice:** `openapi/build/` and generated `schemaValidate.js` files are committed. `npm run spec:check` runs the generator into a temp dir and diffs against committed files; CI fails on any diff.

**Rationale:** Reviewers see generated output in PRs (transparency). Generated files are reproducible (deterministic emission, sorted keys). The alternative (gitignore, generate on build) hides the impact of declaration changes behind diffs that don't show in code review.

**Alternatives considered:**
- Gitignore + generate on install/build — rejected: PRs that change a declaration wouldn't show the generated impact; harder to review.
- Runtime serving from introspection — rejected: loses rich YAML path docs; awkward merge with hand-written operations.

## Risks / Trade-offs

**[BREAKING: `additionalProperties: false` rejects previously-accepted fields]** → Mitigation: per-entity graduation. First migration wave is Taxes only; flip others in separate follow-up changes after auditing each entity's clients. Monitor production 400s on the migrated entity before flipping the next.

**[Generated Joi introduces validation on entities that had none]** → Today `POST /api/taxes/create` accepts any junk Mongoose can cast. After migration, the same POST returns 400 for unknown/invalid fields. This is the intended safety improvement but is technically a behavior change. → Mitigation: documented in proposal; default `additionalProperties: true` during the migration wave preserves permissiveness for entities not yet audited.

**[Controller magic drifts from declaration]** → Declarations *describe* runtime mutation (e.g. "currency is deleted on update") but don't *enforce* it. A future controller change could stop deleting currency and the declaration would lie. → Mitigation: declarations are reviewed alongside controller changes; the `readOnly`/`immutable` annotations live next to the model so they're visible during code review. Long-term: assert at startup that declared `readOnly` fields aren't being written by controllers (out of scope for this change).

**[Two glob patterns must now coexist]** → `models/utils/index.js` globs `*.js` to build the route list. Adding `*.openapi.js` files means the glob must exclude them or they'd be treated as models. → Mitigation: update the glob to ignore `*.openapi.js` and `_*` (the `_components/` directory). Test that the routes list is unchanged after migration.

**[Generator becomes a new dependency for the build]** → If `scripts/gen-spec.js` breaks, the spec becomes un-generatable. → Mitigation: generator is pure Node with only `js-yaml` and `glob` (both already in `node_modules`). No native deps, no network. CI runs `spec:check` on every PR so a broken generator fails fast.

**[Migration of all six entities is out of scope]** → This change only migrates Taxes. The other five (PaymentMode, Invoice, Payment, Client, Quote) follow the same pattern in follow-up changes. → Mitigation: the generator and pipeline are general; each follow-up is a small change (write `<Entity>.openapi.js`, flip `additionalProperties`, extract paths).

## Migration Plan

**Deploy:**
1. Land generator + drift detector + Taxes declaration + Taxes generated artifacts in one change.
2. Wire generic controller to use generated Joi for Taxes.
3. CI runs `spec:check` from this point forward.
4. Existing `openapi/idurar-erp.openapi.yaml` becomes a compatibility shim (single-line re-export from `openapi/build/`).
5. Production: Taxes endpoints now enforce the generated Joi. Monitor 400 rates.

**Rollback:**
- Revert the change. Existing spec file is preserved (paths unchanged; only schemas regenerated). Generic controller falls back to no-validation behavior for Taxes.

**Follow-up changes** (one per entity, in archetype order):
1. PaymentMode — generic, like Taxes.
2. Invoice — unifies existing hand-written Joi; captures controller magic; introduces `LineItem` component.
3. Payment — introduces operation-level declarations; cross-entity side effects.
4. Client — composed controller pattern; unpopulated Admin refs.
5. Quote — generic CRUD + mail + convert extras.

## Open Questions

1. **Should the spec be split per-entity (`openapi/build/schemas/<entity>.yaml`) or one big file?** Per-entity is cleaner for review; one-file matches today's shape. → Current plan: emit per-entity during generation, assemble into one file for serving. Defer multi-file serving.

2. **Should the assembled spec's `info.version` bump on regeneration?** → Current plan: version stays `1.0.0` until a real schema break, then bumps. Additive changes don't warrant version bumps.

3. **Frontend impact of generated response shapes gaining fields?** → Additive only (missing fields appear, none removed). Frontend ignores unknown fields. No coordination needed.

4. **Should `_components/AuditFields.openapi.js` standardize the inconsistent timestamp field names?** Taxes uses `{ timestamps: true }` → `createdAt`/`updatedAt`; Invoice/Client use manual `created`/`updated`. → Defer. Captured as a known smell; future change can standardize via the component registry.
