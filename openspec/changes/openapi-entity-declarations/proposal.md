## Why

The OpenAPI spec at `openapi/idurar-erp.openapi.yaml` (2540 lines) has drifted from the code. Entity schemas omit `required`, `enum`, `default`, `ref`, `readOnly`, and 12+ fields per entity (e.g. Invoice exposes ~10 of its ~25 storage paths). Routes are accurate (auto-registered by glob), but the entity declarations are hand-written and silently lossy. Worse, there are **three** sources of truth that disagree: the Mongoose model (storage), the Joi schema (input gate — only exists for Invoice), and the controller (mutates the body at runtime — deletes `currency`, computes `paymentStatus`, sets `pdf`). The OpenAPI documents none of these accurately. Clients consuming the spec cannot tell what they may create/update, what the server computes, or which fields are immutable.

## What Changes

- Introduce **entity declaration files** (`*.openapi.js`) co-located with Mongoose models. Each declares the API surface for one entity: `create`, `update`, `response`, `fields`, `readOnly`, `ignore`, `additionalProperties`. Authored once, hand-curated.
- Build a **generator** (`scripts/gen-spec.js`) that walks each model's `schema.paths`, applies the declaration's overrides, and emits:
  - OpenAPI `components/schemas/*` (four faces per entity: `<Entity>`, `<Entity>Create`, `<Entity>Update`, `<Entity>Response`)
  - Joi schemas (`schemaValidate.js`) per entity, replacing hand-written ones
- Introduce a **component registry** (`models/_components/`) for shared sub-schemas with no model file (e.g. `LineItem`, `AuditFields`, `Money`).
- Introduce **operation-level declarations** (`operations/*.openapi.js`) for cross-entity workflows that don't fit entity CRUD — `paymentCreate`, `quoteConvert`, `invoiceMail`. These declare side effects on other entities.
- Add a **drift detector** (`scripts/spec-check.js`) that fails CI if generated artifacts are stale relative to declarations/models.
- Wire the generic `createCRUDController` to optionally use a per-entity generated Joi (currently it does no validation — `new Model({ ...req.body }).save()`).
- Reorganize the existing 2540-line spec: hand-written `openapi/paths/*.yaml` (kept), generated `openapi/build/schemas/*.yaml` (new), assembled `openapi/build/idurar-erp.openapi.yaml` (new).
- Migrate entities in order of archetype complexity: **Taxes → PaymentMode → Invoice → Payment → Client → Quote**. **BREAKING** for entities flipped to `additionalProperties: false`: unknown fields now return 400 instead of being silently stripped by Mongoose strict mode.

## Capabilities

### New Capabilities
- `entity-declaration`: Authoring format for declaring an entity's API surface (create/update/response shapes, readOnly fields, refs, enums, additionalProperties) as a sibling file to the Mongoose model. The single authored source of truth from which OpenAPI schemas and Joi validators are generated.
- `spec-generation`: Build-time pipeline that reads entity declarations + Mongoose models + operation declarations, emits OpenAPI components and Joi schemas, and assembles the final spec. Includes a drift detector for CI.
- `cross-entity-operations`: Declaration format for named workflows that mutate multiple entities (e.g. creating a Payment updates Invoice.balance). First-class operations live in `operations/` and are distinct from entity CRUD.

### Modified Capabilities
<!-- None — no spec-level requirements exist prior to this change. The existing OpenAPI file is documentation-only and has no spec contract. -->

## Impact

**Code:**
- New: `scripts/gen-spec.js`, `scripts/spec-check.js`, `models/_components/`, `operations/`, `openapi/paths/`, `openapi/build/`
- Modified: `backend/src/controllers/middlewaresControllers/createCRUDController/` (optional Joi wiring), `package.json` (new npm scripts)
- Per-entity new files: `<Entity>.openapi.js` (authored), generated `<entity>Controller/schemaValidate.js`

**APIs:**
- **BREAKING**: `additionalProperties: false` on migrated entities rejects unknown fields with 400 (today Mongoose strict mode silently strips them and returns 200). Migration is per-entity, gradual.
- Response shapes gain fields they were missing (e.g. Invoice responses now expose `credit`, `isOverdue`, `pdf`, `createdBy`, `created`, `updated`). Additive, non-breaking.

**Dependencies:**
- New dev dependencies: a YAML writer for Node (e.g. `js-yaml` — already in node_modules; `glob` — already in use). Joi is already a dependency.

**Existing OpenAPI:**
- `openapi/idurar-erp.openapi.yaml` becomes either a symlink to `openapi/build/idurar-erp.openapi.yaml` or a compatibility shim. `info`, `servers`, `tags`, `securitySchemes` are preserved; `paths/` are extracted to per-entity files; `components/schemas/` are regenerated.

**CI:**
- New check step: `npm run spec:check` fails the build if generated artifacts don't match committed files.
