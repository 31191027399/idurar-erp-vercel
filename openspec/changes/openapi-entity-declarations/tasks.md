## 1. Foundation

- [x] 1.1 Update `backend/src/models/utils/index.js` glob to exclude `*.openapi.js` and the `_components/` directory; verify the routes list is unchanged by adding a temporary `Taxes.openapi.js` stub and running the existing app
- [x] 1.2 Add `npm scripts` to root `package.json`: `spec:gen` (runs `scripts/gen-spec.js`), `spec:check` (runs `scripts/spec-check.js`)
- [x] 1.3 Verify `js-yaml` and `glob` are present in `node_modules` (both should already be); if not, add as dev dependencies

## 2. Generator

- [x] 2.1 Create `scripts/gen-spec.js` with the five-stage pipeline skeleton (LOAD → PAIR → RESOLVE → EMIT → ASSEMBLE) and CLI entry (`npm run spec:gen`)
- [x] 2.2 Implement Mongoose path walker: given a Mongoose model, produce an intermediate field map with `{ type, required, enum, default, ref, isArray, isNested }` for each path; cover String/Number/Boolean/Date/ObjectId/array/nested (recursive)
- [x] 2.3 Implement the type mapper: convert intermediate field map entries to OpenAPI schema fragments per the type map in design.md
- [x] 2.4 Implement face emitter: given a model's field map + a declaration, emit four YAML documents (`<Entity>`, `<Entity>Create`, `<Entity>Update`, `<Entity>Response`) applying `readOnly`/`ignore`/`required`/`immutable` rules; emit to `openapi/build/schemas/<Entity>.yaml`
- [x] 2.5 Implement declaration loader: glob `appModels/*.openapi.js` + `_components/*.openapi.js`, require each, validate the shape (entity/component key present), pair entity decls with their models by basename, fail loudly on orphan declarations
- [x] 2.6 Implement `$ref` resolver: walk every `$ref` in every declaration and confirm the target exists in the loaded set; emit a clear error on unresolved refs
- [x] 2.7 Implement per-field override application: merge `fields: { ... }` block entries onto inferred schema fragments (description, example, enum, format, ref-input/response knobs)
- [x] 2.8 Implement ref-direction handling: for ref fields, emit oneOf for `input: 'id-or-object'`, `{ $ref: <Target> }` for `response: 'populated'`, `{ type: string, format: objectid }` for `response: 'id'`, readOnly exclusion for `input: 'readOnly'`
- [x] 2.9 Implement Joi emitter: given a face's field map + `additionalProperties`, emit a `schemaValidate.js` file under the entity's controller directory exporting `{ create, update }` as `Joi.object({...}).options({ allowUnknown: <bool> })`; mark file `AUTO-GENERATED` header
- [x] 2.10 Implement determinism: sort schema property keys, sort `required` arrays, stable YAML output (use `js-yaml` dump with `sortKeys: true`); verify two consecutive runs produce byte-identical output
- [x] 2.11 Implement component emission: `_components/*.openapi.js` produce standalone schema components in `openapi/build/schemas/<Component>.yaml`; entities referencing them emit `{ $ref: '#/components/schemas/<Component>' }`
- [x] 2.12 Implement operation declaration emission: read `operations/*.openapi.js`, emit each as an OpenAPI path entry with `description`, `x-validation`, `x-side-effects`; skip route registration (documentation only)

## 3. Assembler

- [x] 3.1 Create `openapi/paths/` directory and extract existing `paths:` from `openapi/idurar-erp.openapi.yaml` into per-entity files (`auth.yaml`, `admin.yaml`, `setting.yaml`, `client.yaml`, `invoice.yaml`, `payment.yaml`, `paymentmode.yaml`, `quote.yaml`, `taxes.yaml`, `files.yaml`); preserve descriptions, examples, security, status codes
- [x] 3.2 Replace `components/schemas:` references in extracted path files with `$ref` to the generated schemas (e.g. `$ref: '#/components/schemas/InvoiceCreate'`); delete the hand-written schema definitions from the path files
- [x] 3.3 Implement the assembler stage in `scripts/gen-spec.js`: combine preserved `info`/`servers`/`tags`/`securitySchemes` + generated `components/schemas/*` + extracted `paths/*` + emitted operations into `openapi/build/idurar-erp.openapi.yaml`
- [x] 3.4 Replace `openapi/idurar-erp.openapi.yaml` with a compatibility shim (re-export from `openapi/build/idurar-erp.openapi.yaml`); preserve the URL for external consumers

## 4. Drift Detector

- [x] 4.1 Create `scripts/spec-check.js`: run the generator into a temp directory, diff temp output against committed `openapi/build/` and generated Joi files; exit non-zero on any diff with a clear "run npm run spec:gen" message
- [x] 4.2 Add the GitHub Actions workflow step running `npm run spec:check` on every PR (extend `.github/workflows/` if a CI workflow exists, otherwise create one)

## 5. Generic Controller Wiring

- [x] 5.1 Modify `backend/src/controllers/middlewaresControllers/createCRUDController/index.js` to accept an optional Joi validator (or have its `create`/`update` methods attempt to load `<entityControllerDir>/schemaValidate.js` by entity name)
- [x] 5.2 Update `create.js` and `update.js` in the generic controller to validate `req.body` when a Joi schema is present, returning HTTP 400 `{ success: false, message: <joiErrorDetails> }` on failure; fall through to today's behavior when no schema exists
- [x] 5.3 Verify entities without generated Joi (PaymentMode, Client, Quote, Payment) still behave exactly as before — no regression

## 6. Taxes Migration (proof of the pipeline)

- [x] 6.1 Author `backend/src/models/appModels/Taxes.openapi.js` declaring `create.required: ['taxName', 'taxValue']`, `create.optional: ['isDefault', 'enabled']`, `create.readOnly: ['_id', 'removed', 'createdAt', 'updatedAt']`, `create.ignore: ['__v']`, `update.immutable: []`, `update.required: []`, `response.populated: []`, `fields: { taxValue: { description, example } }`, `additionalProperties: false`
- [x] 6.2 Create `backend/src/controllers/appControllers/taxesController/` directory; run `npm run spec:gen` to emit `schemaValidate.js` (generated) and an `index.js` if needed (or wire the generic controller to find the Joi file)
- [x] 6.3 Hand-write `openapi/paths/taxes.yaml` documenting all 9 Taxes routes (`create`, `read/{id}`, `update/{id}`, `delete/{id}`, `search`, `list`, `listAll`, `filter`, `summary`), each `$ref`-ing the generated Taxes faces
- [x] 6.4 Run `npm run spec:gen` and commit the generated `openapi/build/schemas/Taxes.yaml`, generated `schemaValidate.js`, and updated `openapi/build/idurar-erp.openapi.yaml`

## 7. Verification

- [x] 7.1 Run `npm run spec:gen` twice and confirm byte-identical output (determinism check)
- [x] 7.2 Run `npm run spec:check` and confirm exit 0 on freshly-generated artifacts
- [x] 7.3 Manually break a declaration (e.g. add a field to `Taxes.openapi.js` without regenerating) and confirm `spec:check` exits non-zero with the right error message
- [x] 7.4 Boot the app (`npm run dev` or equivalent) and verify no route registration errors
- [x] 7.5 POST `/api/taxes/create` with valid input → 200; POST with `{ junk: 'lol' }` → 400 (validates the generic-controller wiring and `additionalProperties: false`)
- [x] 7.6 Confirm external consumers fetching `openapi/idurar-erp.openapi.yaml` see the assembled spec via the compatibility shim
- [x] 7.7 Confirm the routes list in `models/utils/index.js` is unchanged (no spurious routes from `*.openapi.js` files)
