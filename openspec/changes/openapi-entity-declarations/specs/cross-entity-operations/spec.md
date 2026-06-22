## ADDED Requirements

### Requirement: Operation declaration format
Cross-entity workflows SHALL be declared as operation files in `backend/src/operations/<operationName>.openapi.js`. Each SHALL export an object with: `operation` (kebab-case name), `method` (HTTP verb), `path` (URL), `requestBody` (`$ref` to an entity face), `response` (`$ref` to an entity face), `validation` (array of `{ rule, description }`), and `sideEffects` (array of `{ target, op, fields }`).

#### Scenario: Declare a payment creation operation
- **WHEN** an author creates `operations/paymentCreate.openapi.js` exporting `{ operation: 'paymentCreate', method: 'POST', path: '/api/payment/create', requestBody: { $ref: 'PaymentCreate' }, response: { $ref: 'Payment' }, validation: [{ rule: 'amount > 0', description: 'Amount must be greater than zero.' }, { rule: 'amount <= invoice.remainingBalance', description: 'Amount cannot exceed remaining balance.' }], sideEffects: [{ target: 'Invoice', op: 'update', fields: ['credit', 'payment', 'paymentStatus'] }] }`
- **THEN** the generator SHALL accept the file and include it in the assembled spec

### Requirement: Operations render into OpenAPI with side effects visible
The generator SHALL emit each operation as an OpenAPI path entry. The `validation` rules and `sideEffects` SHALL be rendered into the operation's `description` field as structured prose, and also attached as the `x-validation` and `x-side-effects` extensions for machine-readable consumption.

#### Scenario: Side effects documented on payment create
- **WHEN** the `paymentCreate` operation declaration lists a side effect on `Invoice`
- **THEN** the generated OpenAPI path for `POST /api/payment/create` SHALL include an `x-side-effects` extension listing `{ target: 'Invoice', op: 'update', fields: ['credit', 'payment', 'paymentStatus'] }`
- **AND** the `description` field SHALL mention that creating a payment updates the related invoice's balance

### Requirement: Operations do not auto-generate CRUD routes
Operation declarations SHALL NOT register any routes in the running Express app. They are documentation-only artifacts. The actual route registration continues to happen in `appRoutes/appApi.js` and entity-specific controller code (e.g. `paymentController/create.js`).

#### Scenario: Adding an operation declaration does not register a route
- **WHEN** an author creates `operations/paymentCreate.openapi.js`
- **THEN** no new routes SHALL be registered in the running app
- **AND** the existing `/api/payment/create` route (registered by `paymentController`) SHALL continue to function unchanged

### Requirement: Cross-field and cross-entity validation rules are descriptive
Validation rules declared in an operation's `validation` array SHALL be treated as descriptive (human-readable documentation rendered into the spec). They are NOT enforced by generated code. Enforcement remains in the controller (e.g. `paymentController/create.js` checking `amount > 0` and `amount <= remainingBalance`).

#### Scenario: Operation validation rule is not enforced by generator
- **WHEN** the `paymentCreate` operation declares a validation rule `amount <= invoice.remainingBalance`
- **THEN** the generated Joi SHALL NOT include a cross-entity constraint on `amount`
- **AND** the rule SHALL appear only in the OpenAPI `description` and `x-validation` extension
