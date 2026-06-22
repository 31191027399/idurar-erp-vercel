## ADDED Requirements

### Requirement: Entity declaration file format
Each entity SHALL have a sibling declaration file at `<modelsDir>/<Entity>.openapi.js` (e.g. `appModels/Taxes.openapi.js`) that exports a plain object describing the entity's API surface. The file SHALL declare, at minimum: `entity` (name), `create` (with `required`, `optional`, `readOnly`, `ignore` arrays), `update` (with `immutable`, `required` arrays), `response` (with `populated` array), `fields` (per-field overrides), and `additionalProperties` (boolean).

#### Scenario: Minimal valid declaration
- **WHEN** an author creates `appModels/Taxes.openapi.js` exporting `{ entity: 'Taxes', create: { required: ['taxName', 'taxValue'], optional: ['isDefault', 'enabled'], readOnly: ['_id', 'removed', 'createdAt', 'updatedAt'], ignore: ['__v'] }, update: { immutable: [], required: [] }, response: { populated: [] }, fields: {}, additionalProperties: false }`
- **THEN** the generator SHALL accept the file without error and pair it with `appModels/Taxes.js`

#### Scenario: Declaration with no matching model is rejected
- **WHEN** an `*.openapi.js` file exists in `appModels/` with no corresponding `<Entity>.js` model file
- **THEN** the generator SHALL fail with an error naming the orphan declaration

### Requirement: readOnly fields are excluded from input faces
Fields listed in `create.readOnly` SHALL appear in the response face (`<Entity>`) marked `readOnly: true`, and SHALL NOT appear in the `<Entity>Create` or `<Entity>Update` faces. This captures server-set fields like `_id`, `createdAt`, `createdBy`, and computed fields like `credit`, `paymentStatus`.

#### Scenario: Server-set field on Taxes
- **WHEN** `Taxes.js` defines `removed: { type: Boolean, default: false }` and `Taxes.openapi.js` lists `removed` in `create.readOnly`
- **THEN** the generated `Taxes` schema SHALL include `removed: { type: boolean, default: false, readOnly: true }`
- **AND** the generated `TaxesCreate` schema SHALL NOT include `removed`

### Requirement: update.immutable excludes fields from the update face
Fields listed in `update.immutable` SHALL appear in the response face but SHALL NOT appear in the `<Entity>Update` face. This captures fields the controller refuses to change after creation (e.g. `currency`, `number` on Invoice).

#### Scenario: Immutable field excluded from update face
- **WHEN** a declaration lists `currency` in `update.immutable`
- **THEN** the generated `<Entity>Update` schema SHALL NOT contain a `currency` property
- **AND** the generated response `<Entity>` schema SHALL still contain `currency`

### Requirement: fields block overrides generator inference
The `fields` block SHALL let authors override any property the generator would infer from the Mongoose schema. Overrides include `type`, `description`, `example`, `enum`, `format`, `$ref`, and ref-direction knobs (`ref`, `input`, `response`).

#### Scenario: Override a field description
- **WHEN** `Taxes.openapi.js` declares `fields: { taxValue: { description: 'Tax rate as a string...', example: '7.5' } }`
- **THEN** the generated `Taxes` and `TaxesCreate` schemas SHALL include the description and example on `taxValue`

#### Scenario: Declare ref input/response shapes
- **WHEN** `Invoice.openapi.js` declares `fields: { client: { ref: 'Client', input: 'id-or-object', response: 'populated' } }`
- **THEN** the generated `InvoiceCreate.client` SHALL be a oneOf of `{ type: string, format: objectid }` and `{ $ref: ClientCreate }`
- **AND** the generated `Invoice.client` SHALL be `{ $ref: Client }`

### Requirement: Component registry for shared sub-schemas
Declarations in `appModels/_components/` SHALL be treated as component-only: they have no model file, generate no routes, and exist only to be `$ref`'d by entities. A component declaration SHALL export `{ component: '<Name>', ...fieldShape }`.

#### Scenario: LineItem shared by Invoice and Quote
- **WHEN** `appModels/_components/LineItem.openapi.js` exists and both `Invoice.openapi.js` and `Quote.openapi.js` declare `items: { $ref: 'LineItem' }`
- **THEN** the generator SHALL emit one `LineItem` schema component
- **AND** both `Invoice` and `Quote` schemas SHALL reference it via `$ref: '#/components/schemas/LineItem'`

### Requirement: Glob excludes declaration files from route registration
The existing model glob in `models/utils/index.js` SHALL exclude `*.openapi.js` files and the `_components/` directory so they are not treated as models and do not generate routes.

#### Scenario: Adding a declaration does not register routes
- **WHEN** an author creates `appModels/Taxes.openapi.js`
- **THEN** the routes list built by `models/utils/index.js` SHALL be unchanged
- **AND** no new routes SHALL be registered in the running app
