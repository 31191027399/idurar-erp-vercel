## ADDED Requirements

### Requirement: Build-time generation from declarations
The system SHALL provide a Node script (`scripts/gen-spec.js`, runnable via `npm run spec:gen`) that reads entity declarations, component declarations, operation declarations, and Mongoose models, and emits three categories of artifact: OpenAPI schema components under `openapi/build/schemas/`, generated Joi validators at `<entityControllerDir>/schemaValidate.js`, and an assembled full spec at `openapi/build/idurar-erp.openapi.yaml`.

#### Scenario: Run the generator with one declaration
- **WHEN** `appModels/Taxes.openapi.js` exists and the author runs `npm run spec:gen`
- **THEN** the script SHALL write `openapi/build/schemas/Taxes.yaml` containing four faces (`Taxes`, `TaxesCreate`, `TaxesUpdate`, `TaxesResponse`)
- **AND** SHALL write a generated Joi validator at the Taxes controller path
- **AND** SHALL update `openapi/build/idurar-erp.openapi.yaml` with the generated components

#### Scenario: Generator is deterministic
- **WHEN** `npm run spec:gen` is run twice in a row without any input change
- **THEN** the emitted files SHALL be byte-identical between the two runs (sorted keys, stable ordering)

### Requirement: Mongoose path walking with type mapping
The generator SHALL walk each model's `Model.schema.paths` and `Model.schema.nestedPaths` and map Mongoose types to OpenAPI per a fixed type map (String→string, Number→number, Boolean→boolean, Date→string/date-time, ObjectId→string/objectid, arrays→items, nested→object/properties). It SHALL extract `required`, `enum`, and `default` from each path.

#### Scenario: Map a simple field
- **WHEN** a model declares `taxName: { type: String, required: true }`
- **THEN** the generated schema SHALL include `taxName: { type: string }` and the parent `required` array SHALL include `taxName`

#### Scenario: Map an enum
- **WHEN** a model declares `status: { type: String, enum: ['draft', 'sent'] }`
- **THEN** the generated schema SHALL include `status: { type: string, enum: ['draft', 'sent'] }`

### Requirement: Four faces per entity
For each entity declaration, the generator SHALL emit four OpenAPI schemas: `<Entity>` (full response shape, includes readOnly fields), `<Entity>Create` (writeOnly subset, excludes readOnly and ignore, includes create.required), `<Entity>Update` (excludes readOnly, ignore, and update.immutable; all optional unless in update.required), and `<Entity>Response` (alias of `<Entity>`).

#### Scenario: Taxes emits four faces
- **WHEN** `Taxes.openapi.js` declares `create.required: ['taxName', 'taxValue']`, `create.readOnly: ['_id', 'removed', 'createdAt', 'updatedAt']`, and `create.ignore: ['__v']`
- **THEN** the emitted `Taxes.yaml` SHALL contain four top-level schemas matching those names
- **AND** `TaxesCreate.required` SHALL equal `['taxName', 'taxValue']`
- **AND** `TaxesCreate` SHALL NOT contain `_id`, `removed`, `createdAt`, `updatedAt`, or `__v`

### Requirement: Joi generation mirrors additionalProperties
The generator SHALL emit a Joi validator per entity that mirrors the declaration's `additionalProperties` stance: `additionalProperties: false` maps to Joi `.options({ allowUnknown: false })`; `additionalProperties: true` maps to `.options({ allowUnknown: true })`. The validator SHALL export `{ create, update }` where each is a `Joi.object({...})` matching the corresponding OpenAPI face.

#### Scenario: Strict entity emits strict Joi
- **WHEN** `Taxes.openapi.js` declares `additionalProperties: false`
- **THEN** the generated `schemaValidate.js` SHALL include `.options({ allowUnknown: false })` on both `create` and `update` schemas
- **AND** submitting `{ taxName: 'x', taxValue: '5', junk: 'lol' }` to the `create` validator SHALL return a validation error

### Requirement: Drift detector fails CI on stale artifacts
The system SHALL provide `scripts/spec-check.js` (runnable via `npm run spec:check`) that runs the generator into a temp directory and diffs the output against the committed artifacts in `openapi/build/` and the generated Joi files. If any file differs, the script SHALL exit non-zero with a message instructing the developer to run `npm run spec:gen` and commit the result.

#### Scenario: Committed artifacts match generation
- **WHEN** a developer runs `npm run spec:gen`, commits the result, and CI runs `npm run spec:check`
- **THEN** the check SHALL exit 0

#### Scenario: Stale artifacts fail the check
- **WHEN** a developer edits `Taxes.openapi.js` to add a field but does not regenerate
- **THEN** `npm run spec:check` SHALL exit non-zero
- **AND** the error message SHALL name the stale file(s) and instruct regeneration

### Requirement: Generic controller uses generated Joi when present
The generic `createCRUDController` SHALL, on `create` and `update`, attempt to load a generated `schemaValidate.js` for the entity. If present, it SHALL validate `req.body` against the corresponding schema and return HTTP 400 with `{ success: false, message }` on failure. If no `schemaValidate.js` exists for the entity, the controller SHALL fall through to today's no-validation behavior.

#### Scenario: Entity with generated Joi rejects invalid input
- **WHEN** `Taxes.openapi.js` declares `additionalProperties: false` and the generated Joi is in place
- **AND** a client POSTs `/api/taxes/create` with `{ junk: 'lol' }`
- **THEN** the controller SHALL return HTTP 400 with `{ success: false, message: <joi error> }`

#### Scenario: Entity without Joi preserves today's behavior
- **WHEN** an entity has no `schemaValidate.js` (e.g. PaymentMode before migration)
- **AND** a client POSTs to its create endpoint with arbitrary fields
- **THEN** the controller SHALL behave as before (spread `req.body` into the model)

### Requirement: Existing spec reorganized without losing path docs
The existing `openapi/idurar-erp.openapi.yaml` SHALL be split: `info`, `servers`, `tags`, `components.securitySchemes` are preserved; `paths/` are extracted to per-entity files under `openapi/paths/` (referencing generated schemas via `$ref`); `components/schemas/` are replaced by generated output. The legacy file path SHALL remain valid via a compatibility shim that re-exports `openapi/build/idurar-erp.openapi.yaml`.

#### Scenario: External consumers see the same URL
- **WHEN** an external consumer fetches `openapi/idurar-erp.openapi.yaml` after migration
- **THEN** the content SHALL be the assembled spec from `openapi/build/`
- **AND** all previously-documented paths SHALL still be present with their descriptions and examples intact
