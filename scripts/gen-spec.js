#!/usr/bin/env node
/**
 * scripts/gen-spec.js
 *
 * Build-time generator for OpenAPI + Joi from Mongoose models + authored
 * entity declarations (*.openapi.js).
 *
 * Pipeline: LOAD -> PAIR -> RESOLVE -> EMIT -> ASSEMBLE
 *
 * Outputs (all committed; CI verifies via spec-check.js):
 *   openapi/build/schemas/<Entity>.yaml       (four faces per entity)
 *   openapi/build/schemas/<Component>.yaml    (component-only schemas)
 *   openapi/build/idurar-erp.openapi.yaml     (assembled full spec)
 *   backend/src/controllers/appControllers/_generated/entitySchemas.js (Joi)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const yaml = require('js-yaml');
const mongoose = require(path.join(__dirname, '..', 'backend', 'node_modules', 'mongoose'));

const ROOT = path.resolve(__dirname, '..');
const APP_MODELS_DIR = path.join(ROOT, 'backend/src/models/appModels');
const COMPONENTS_DIR = path.join(APP_MODELS_DIR, '_components');
const OPERATIONS_DIR = path.join(ROOT, 'backend/src/operations');
const PATHS_DIR = path.join(ROOT, 'openapi/paths');
const LEGACY_SCHEMAS_PATH = path.join(ROOT, 'openapi/legacy-schemas.yaml');
const LEGACY_PATHS_PATH = path.join(ROOT, 'openapi/legacy-paths.yaml');
const LEGACY_SPEC_PATH = path.join(ROOT, 'openapi/idurar-erp.openapi.yaml');
const BUILD_SCHEMAS_DIR = path.join(ROOT, 'openapi/build/schemas');
const BUILD_SPEC_PATH = path.join(ROOT, 'openapi/build/idurar-erp.openapi.yaml');
const GENERATED_JOI_PATH = path.join(ROOT, 'backend/src/controllers/appControllers/_generated/entitySchemas.js');

const SPEC_HEADER = {
  openapi: '3.0.3',
  info: {
    title: 'IDURAR ERP API',
    version: '1.0.0',
    description:
      'OpenAPI specification for the current Express routes in this repository.\n' +
      'Entity schemas are GENERATED from Mongoose models + authored *.openapi.js declarations.\n' +
      'Do not edit openapi/build/* by hand; run `npm run spec:gen`.',
  },
  servers: [
    { url: 'http://localhost:8888', description: 'Local backend' },
    { url: 'https://idurar-erp-vercel.vercel.app', description: 'Vercel deployment' },
  ],
  tags: [],
};
const SECURITY_SCHEMES = {
  bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
};

// ---------------------------------------------------------------------------
// Stage 1: LOAD
// ---------------------------------------------------------------------------

function loadDeclarations() {
  const entityFiles = globSync(path.join(APP_MODELS_DIR, '*.openapi.js'));
  const componentFiles = globSync(path.join(COMPONENTS_DIR, '*.openapi.js'));
  const operationFiles = globSync(path.join(OPERATIONS_DIR, '*.openapi.js'));

  const entities = entityFiles.map((f) => ({ file: f, decl: require(f) }));
  const components = componentFiles.map((f) => ({ file: f, decl: require(f) }));
  const operations = operationFiles.map((f) => ({ file: f, decl: require(f) }));

  // Validate shape
  for (const { file, decl } of entities) {
    if (!decl || !decl.entity) {
      throw new Error(`Entity declaration ${file} must export { entity: 'Name', ... }`);
    }
  }
  for (const { file, decl } of components) {
    if (!decl || !decl.component) {
      throw new Error(`Component declaration ${file} must export { component: 'Name', ... }`);
    }
  }
  for (const { file, decl } of operations) {
    if (!decl || !decl.operation) {
      throw new Error(`Operation declaration ${file} must export { operation: 'name', ... }`);
    }
  }

  return { entities, components, operations };
}

// ---------------------------------------------------------------------------
// Stage 2: PAIR
// ---------------------------------------------------------------------------

function requireModelFor(entityName) {
  const expectedPath = path.join(APP_MODELS_DIR, `${entityName}.js`);
  if (!fs.existsSync(expectedPath)) {
    throw new Error(
      `Entity declaration for "${entityName}" has no matching model at ${expectedPath}`
    );
  }
  require(expectedPath); // registers on mongoose
  return mongoose.model(entityName);
}

function pairEntities(entityDecls) {
  const pairs = [];
  for (const { file, decl } of entityDecls) {
    const model = requireModelFor(decl.entity);
    pairs.push({ file, decl, model });
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Stage 3: RESOLVE
// ---------------------------------------------------------------------------

function resolveRefs(pairs, components) {
  const knownNames = new Set([
    ...pairs.map((p) => p.decl.entity),
    ...components.map((c) => c.decl.component),
  ]);

  function walk(value, context) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, context));
      return;
    }
    if ('$ref' in value) {
      const ref = value.$ref;
      if (!knownNames.has(ref)) {
        throw new Error(`Unresolved $ref '${ref}' in ${context}`);
      }
    }
    for (const v of Object.values(value)) walk(v, context);
  }

  for (const { file, decl } of pairs) {
    walk(decl, `entity ${decl.entity} (${path.basename(file)})`);
  }
  for (const { file, decl } of components) {
    walk(decl, `component ${decl.component} (${path.basename(file)})`);
  }
}

// ---------------------------------------------------------------------------
// Stage 4a: WALK MONGOOSE SCHEMA -> intermediate field map
// ---------------------------------------------------------------------------

function isDateDefaultFn(def) {
  // Mongoose represents Date.now / Date.now as the function itself.
  return def === Date.now || (def && def.name === 'now');
}

function walkPrimitive(p) {
  // Determine type from Mongoose path instance.
  const inst = p.instance;
  const opts = p.options || {};
  const out = {};

  // Type
  if (inst === 'String') out.type = 'string';
  else if (inst === 'Number') out.type = 'number';
  else if (inst === 'Boolean') out.type = 'boolean';
  else if (inst === 'Date') {
    out.type = 'string';
    out.format = 'date-time';
  } else if (inst === 'ObjectID' || inst === 'ObjectId') {
    out.type = 'string';
    out.format = 'objectid';
  } else if (inst === 'Object' || inst === 'Mixed') {
    out.type = 'object';
  } else {
    // Unknown / custom; default to string and let author override
    out.type = 'string';
  }

  // Ref
  if (opts.ref) out.ref = opts.ref;

  // Enum
  const enumVals = p.enumValues && p.enumValues.length > 0 ? p.enumValues : null;
  if (enumVals) out.enum = enumVals;

  // Required
  const required =
    typeof opts.required === 'function'
      ? false // dynamic required — opt out; author declares explicitly
      : !!opts.required;
  if (required) out.required = true;

  // Default
  if ('default' in opts) {
    const def = opts.default;
    if (typeof def === 'function') {
      // Date.now, () => Date.now(), () => uuid(), etc.
      if (isDateDefaultFn(def) || (def.name === 'now' && inst === 'Date')) {
        out.default = '<server-set: now>';
      } else {
        out.default = '<server-set: function>';
      }
    } else if (def !== undefined) {
      out.default = def;
    }
  }

  return out;
}

function walkArray(path) {
  const caster = path.caster;
  if (!caster) {
    // Array of primitives — type from the base array's options.type
    return { type: 'array', items: { type: 'string' } };
  }
  // Array of subdocs?
  if (caster.schema) {
    const itemsMap = walkSchema(caster.schema);
    return { type: 'array', items: { type: 'object', __fieldMap: itemsMap } };
  }
  // Array of refs?
  if (caster.options && caster.options.ref) {
    return {
      type: 'array',
      items: { type: 'string', format: 'objectid', ref: caster.options.ref },
    };
  }
  // Array of primitives
  const samplePath = { instance: caster.instance, options: caster.options || {}, enumValues: [] };
  const itemsSchema = walkPrimitive(samplePath);
  return { type: 'array', items: itemsSchema };
}

function walkNestedObject(schema) {
  // Single nested subdoc
  const fieldMap = walkSchema(schema);
  return { type: 'object', __fieldMap: fieldMap };
}

function walkSchema(schema) {
  const fieldMap = {};
  for (const [name, p] of Object.entries(schema.paths)) {
    if (p.$isSingleNested) {
      fieldMap[name] = walkNestedObject(p.schema);
    } else if (p.instance === 'Array') {
      fieldMap[name] = walkArray(p);
    } else {
      fieldMap[name] = walkPrimitive(p);
    }
  }
  return fieldMap;
}

function modelToFieldMap(model) {
  const fieldMap = walkSchema(model.schema);
  return fieldMap;
}

// ---------------------------------------------------------------------------
// Stage 4b: apply declaration overrides
// ---------------------------------------------------------------------------

function applyFieldOverrides(fieldMap, decl) {
  const overrides = decl.fields || {};
  for (const [name, override] of Object.entries(overrides)) {
    if (!(name in fieldMap)) {
      // New author-declared field not in model — allow it (e.g. computed fields
      // surfaced in responses like `isOverdue`)
      fieldMap[name] = {};
    }
    fieldMap[name] = { ...fieldMap[name], ...override };
  }
}

function categorizeFields(fieldMap, decl) {
  const create = decl.create || {};
  const update = decl.update || {};
  const readOnly = new Set(create.readOnly || []);
  const ignore = new Set(create.ignore || []);
  const immutable = new Set(update.immutable || []);

  const all = Object.keys(fieldMap).filter((n) => !ignore.has(n));
  return { all, readOnly, ignore, immutable };
}

// ---------------------------------------------------------------------------
// Stage 4c: face emitter (field map + decl -> OpenAPI schema fragments)
// ---------------------------------------------------------------------------

function materializeField(name, fmEntry, decl, face) {
  // face: 'response' | 'create' | 'update'
  // Recursively turn field-map entries into OpenAPI schema fragments.
  const out = {};

  if (fmEntry.$ref) {
    return { $ref: `#/components/schemas/${fmEntry.$ref}` };
  }

  // Array
  if (fmEntry.type === 'array') {
    const items = fmEntry.items || {};
    if (items.$ref) {
      out.type = 'array';
      out.items = { $ref: `#/components/schemas/${items.$ref}` };
    } else if (items.__fieldMap) {
      // Array of inline subdocs — recursively materialize
      out.type = 'array';
      const subProps = {};
      const subRequired = [];
      for (const [subName, subFm] of Object.entries(items.__fieldMap)) {
        subProps[subName] = materializeField(subName, subFm, decl, face);
        if (subFm.required) subRequired.push(subName);
      }
      out.items = { type: 'object', properties: subProps };
      if (subRequired.length > 0) out.items.required = subRequired;
    } else {
      out.type = 'array';
      out.items = materializeField(name + '[]', items, decl, face);
    }
    if ('description' in fmEntry) out.description = fmEntry.description;
    if ('example' in fmEntry) out.example = fmEntry.example;
    return out;
  }

  // Nested object
  if (fmEntry.type === 'object' && fmEntry.__fieldMap) {
    const subProps = {};
    const subRequired = [];
    for (const [subName, subFm] of Object.entries(fmEntry.__fieldMap)) {
      subProps[subName] = materializeField(subName, subFm, decl, face);
      if (subFm.required) subRequired.push(subName);
    }
    out.type = 'object';
    out.properties = subProps;
    if (subRequired.length > 0) out.required = subRequired;
    return out;
  }

  // Ref field — face-dependent shape
  if (fmEntry.ref) {
    if (face === 'create' || face === 'update') {
      const input = fmEntry.input || 'id';
      if (input === 'readOnly') return null; // excluded from input
      if (input === 'id-or-object') {
        return {
          oneOf: [
            { type: 'string', format: 'objectid' },
            { $ref: `#/components/schemas/${fmEntry.ref}Create` },
          ],
        };
      }
      // default: id
      return { type: 'string', format: 'objectid' };
    } else {
      // response
      const resp = fmEntry.response || 'populated';
      if (resp === 'populated') return { $ref: `#/components/schemas/${fmEntry.ref}` };
      if (resp === 'id-array') {
        return { type: 'array', items: { type: 'string', format: 'objectid' } };
      }
      // default: id
      return { type: 'string', format: 'objectid' };
    }
  }

  // Primitive
  out.type = fmEntry.type;
  if (fmEntry.format) out.format = fmEntry.format;
  if (fmEntry.enum) out.enum = fmEntry.enum;
  if (fmEntry.description) out.description = fmEntry.description;
  if (fmEntry.example !== undefined) out.example = fmEntry.example;

  return out;
}

function emitFace(entity, fieldMap, decl, face) {
  const { readOnly, immutable } = categorizeFields(fieldMap, decl);
  const properties = {};
  const required = [];

  const create = decl.create || {};
  const update = decl.update || {};
  const createRequired = new Set(create.required || []);
  const updateRequired = new Set(update.required || []);

  for (const [name, fmEntry] of Object.entries(fieldMap)) {
    // Face-specific filtering
    if (face === 'response') {
      // include everything (except ignore)
      if (create.ignore && create.ignore.includes(name)) continue;
      const schemaFrag = materializeField(name, fmEntry, decl, face);
      if (schemaFrag === null) continue;
      if (readOnly.has(name)) schemaFrag.readOnly = true;
      properties[name] = schemaFrag;
    } else if (face === 'create') {
      if (readOnly.has(name)) continue;
      if (create.ignore && create.ignore.includes(name)) continue;
      const schemaFrag = materializeField(name, fmEntry, decl, face);
      if (schemaFrag === null) continue;
      schemaFrag.writeOnly = true;
      properties[name] = schemaFrag;
      if (createRequired.has(name)) required.push(name);
    } else if (face === 'update') {
      if (readOnly.has(name)) continue;
      if (immutable.has(name)) continue;
      if (create.ignore && create.ignore.includes(name)) continue;
      const schemaFrag = materializeField(name, fmEntry, decl, face);
      if (schemaFrag === null) continue;
      properties[name] = schemaFrag;
      if (updateRequired.has(name)) required.push(name);
    }
  }

  const out = {
    type: 'object',
    additionalProperties: decl.additionalProperties === true,
    properties,
  };
  required.sort();
  if (required.length > 0) out.required = required;
  if (decl.description) out.description = decl.description;
  return out;
}

function emitEntitySchemas(entity, fieldMap, decl) {
  return {
    [entity]: emitFace(entity, fieldMap, decl, 'response'),
    [`${entity}Create`]: emitFace(entity, fieldMap, decl, 'create'),
    [`${entity}Update`]: emitFace(entity, fieldMap, decl, 'update'),
    [`${entity}Response`]: { $ref: `#/components/schemas/${entity}` },
  };
}

// ---------------------------------------------------------------------------
// Stage 4d: component emitter
// ---------------------------------------------------------------------------

function emitComponentSchema(decl) {
  // Components have no model — they use `fields` directly as a field map.
  const fieldMap = {};
  const fields = decl.fields || {};
  for (const [name, defn] of Object.entries(fields)) {
    fieldMap[name] = { ...defn };
  }
  const properties = {};
  const required = [];
  for (const [name, fmEntry] of Object.entries(fieldMap)) {
    properties[name] = materializeField(name, fmEntry, decl, 'response');
    if (fmEntry.required) required.push(name);
  }
  const out = {
    type: 'object',
    additionalProperties: decl.additionalProperties === true,
    properties,
  };
  required.sort();
  if (required.length > 0) out.required = required;
  if (decl.description) out.description = decl.description;
  return { [decl.component]: out };
}

// ---------------------------------------------------------------------------
// Stage 4e: Joi emitter
// ---------------------------------------------------------------------------

function joiForField(fmEntry, face) {
  // Returns a string of Joi builder calls.
  if (fmEntry.$ref) {
    // Ref to another component — emit as Joi.object().allow(null) for now.
    return 'Joi.object().unknown(true)';
  }
  if (fmEntry.ref) {
    if (face === 'create' || face === 'update') {
      const input = fmEntry.input || 'id';
      if (input === 'readOnly') return null;
      if (input === 'id-or-object') {
        return 'Joi.alternatives().try(Joi.string(), Joi.object())';
      }
      return 'Joi.string()';
    }
    return 'Joi.alternatives().try(Joi.string(), Joi.object())';
  }
  if (fmEntry.type === 'array') {
    const items = fmEntry.items || {};
    if (items.__fieldMap) {
      const subFields = Object.entries(items.__fieldMap)
        .map(([subName, subFm]) => {
          const sub = joiForField(subFm, face);
          if (sub === null) return null;
          return `    ${subName}: ${sub}${subFm.required ? '.required()' : ''}`;
        })
        .filter(Boolean)
        .join(',\n');
      return `Joi.array().items(Joi.object({\n${subFields}\n  }))`;
    }
    if (items.ref) {
      return `Joi.array().items(Joi.string())`;
    }
    const primitive = joiPrimitive(items);
    return `Joi.array().items(${primitive})`;
  }
  if (fmEntry.type === 'object' && fmEntry.__fieldMap) {
    const subFields = Object.entries(fmEntry.__fieldMap)
      .map(([subName, subFm]) => {
        const sub = joiForField(subFm, face);
        if (sub === null) return null;
        return `    ${subName}: ${sub}${subFm.required ? '.required()' : ''}`;
      })
      .filter(Boolean)
      .join(',\n');
    return `Joi.object({\n${subFields}\n  })`;
  }
  return joiPrimitive(fmEntry);
}

function joiPrimitive(fmEntry) {
  let s = '';
  switch (fmEntry.type) {
    case 'string':
      s = 'Joi.string()';
      break;
    case 'number':
      s = 'Joi.number()';
      break;
    case 'boolean':
      s = 'Joi.boolean()';
      break;
    default:
      s = 'Joi.any()';
  }
  if (fmEntry.enum && fmEntry.enum.length) {
    const vals = fmEntry.enum.map((v) => `'${v}'`).join(', ');
    s += `.valid(${vals})`;
  }
  return s;
}

function emitJoiForEntity(entity, fieldMap, decl) {
  const create = decl.create || {};
  const update = decl.update || {};
  const readOnly = new Set(create.readOnly || []);
  const ignore = new Set(create.ignore || []);
  const immutable = new Set(update.immutable || []);
  const createRequired = new Set(create.required || []);
  const updateRequired = new Set(update.required || []);

  function emitFields(face) {
    const lines = [];
    for (const [name, fmEntry] of Object.entries(fieldMap)) {
      if (ignore.has(name)) continue;
      if (face === 'create' && readOnly.has(name)) continue;
      if (face === 'update' && (readOnly.has(name) || immutable.has(name))) continue;
      const joi = joiForField(fmEntry, face);
      if (joi === null) continue;
      const isReq = face === 'create' ? createRequired.has(name) : updateRequired.has(name);
      const suffix = isReq ? '.required()' : '';
      lines.push(`    ${name}: ${joi}${suffix},`);
    }
    return lines.join('\n');
  }

  const allowUnknown = decl.additionalProperties === true;

  return `  '${entity}': {
    create: Joi.object({
${emitFields('create')}
    }).options({ stripUnknown: false, allowUnknown: ${allowUnknown} }),
    update: Joi.object({
${emitFields('update')}
    }).options({ stripUnknown: false, allowUnknown: ${allowUnknown} }),
  },`;
}

function emitJoiFile(pairs) {
  const entityBlocks = pairs.map(({ decl, model }) => {
    const fieldMap = modelToFieldMap(model);
    applyFieldOverrides(fieldMap, decl);
    return emitJoiForEntity(decl.entity, fieldMap, decl);
  });
  return `// AUTO-GENERATED by scripts/gen-spec.js from *.openapi.js declarations.
// Do not edit by hand. CI will reject manual changes via \`npm run spec:check\`.

const Joi = require('joi');

module.exports = {
${entityBlocks.join('\n')}
};
`;
}

// ---------------------------------------------------------------------------
// Stage 5: ASSEMBLE
// ---------------------------------------------------------------------------

function loadLegacySchemas() {
  // Read the legacy hand-written schemas (entities pending migration).
  if (!fs.existsSync(LEGACY_SCHEMAS_PATH)) {
    return {};
  }
  const doc = yaml.load(fs.readFileSync(LEGACY_SCHEMAS_PATH, 'utf8'));
  return (doc && doc.components && doc.components.schemas) || {};
}

function loadLegacyPaths() {
  // Hand-written paths preserved from the original spec, awaiting per-entity
  // extraction into openapi/paths/*.yaml as entities migrate.
  if (!fs.existsSync(LEGACY_PATHS_PATH)) return {};
  const doc = yaml.load(fs.readFileSync(LEGACY_PATHS_PATH, 'utf8'));
  return (doc && doc.paths) || {};
}

function loadExistingPaths() {
  // Hand-written per-entity path files in openapi/paths/*.yaml.
  // These OVERRIDE legacy paths (for migrated entities with extracted paths).
  const files = globSync(path.join(PATHS_DIR, '*.yaml'));
  const paths = {};
  for (const f of files) {
    const doc = yaml.load(fs.readFileSync(f, 'utf8'));
    if (doc && doc.paths) Object.assign(paths, doc.paths);
  }
  return paths;
}

function emitOperationToPath(decl) {
  const method = (decl.method || 'post').toLowerCase();
  const op = {
    tags: decl.tags || [decl.operation],
    summary: decl.summary || decl.operation,
    description: decl.description || '',
    security: decl.security || [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    responses: decl.responses || {
      '200': {
        description: 'OK',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
      },
    },
  };

  // Render validation rules + side effects into description + extensions
  const validation = decl.validation || [];
  const sideEffects = decl.sideEffects || [];

  if (validation.length > 0) {
    op['x-validation'] = validation;
    const lines = validation.map((v) => `  - ${v.description || v.rule}`);
    op.description += `\n\nValidation rules:\n${lines.join('\n')}`;
  }
  if (sideEffects.length > 0) {
    op['x-side-effects'] = sideEffects;
    const lines = sideEffects.map(
      (s) => `  - Updates ${s.target}: ${s.fields ? s.fields.join(', ') : '(unspecified)'}`
    );
    op.description += `\n\nSide effects:\n${lines.join('\n')}`;
  }

  if (decl.requestBody) {
    op.requestBody = {
      required: true,
      content: { 'application/json': { schema: materializeRef(decl.requestBody) } },
    };
  }

  return { [decl.path]: { [method]: op } };
}

function materializeRef(refObj) {
  if (!refObj) return undefined;
  if (refObj.$ref) {
    return { $ref: `#/components/schemas/${refObj.$ref}` };
  }
  return refObj;
}

function collectTagsFromPaths(paths) {
  const tags = new Set();
  for (const pathObj of Object.values(paths)) {
    for (const op of Object.values(pathObj)) {
      if (op && Array.isArray(op.tags)) {
        op.tags.forEach((t) => tags.add(t));
      }
    }
  }
  return tags;
}

function assembleSpec(entitySchemas, componentSchemas, operationDecls) {
  // Determine which schema names are GENERATED (these override legacy).
  const generatedNames = new Set();
  for (const { schemas } of entitySchemas) {
    for (const k of Object.keys(schemas)) generatedNames.add(k);
  }
  for (const { schemas } of componentSchemas) {
    for (const k of Object.keys(schemas)) generatedNames.add(k);
  }

  // Legacy schemas (hand-written, awaiting migration). Filter out any whose
  // name is also generated — generated wins.
  const legacySchemas = loadLegacySchemas();
  const legacySurviving = {};
  for (const [name, schema] of Object.entries(legacySchemas)) {
    if (!generatedNames.has(name)) {
      legacySurviving[name] = schema;
    }
  }

  // Components: legacy (filtered) + generated on top.
  const components = {
    securitySchemes: SECURITY_SCHEMES,
    schemas: {
      ...legacySurviving,
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          result: { nullable: true },
          message: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: { page: { type: 'integer' }, pages: { type: 'integer' }, count: { type: 'integer' } },
      },
      PaginatedResponse: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponse' },
          { type: 'object', properties: { pagination: { $ref: '#/components/schemas/Pagination' } } },
        ],
      },
      ...entitySchemas.reduce((acc, { schemas }) => ({ ...acc, ...schemas }), {}),
      ...componentSchemas.reduce((acc, { schemas }) => ({ ...acc, ...schemas }), {}),
    },
  };

  // Paths: legacy (hand-written, base) + per-entity overrides + operations
  const paths = { ...loadLegacyPaths(), ...loadExistingPaths() };
  for (const { decl } of operationDecls) {
    Object.assign(paths, emitOperationToPath(decl));
  }

  // Tags: collect from all path operations (legacy + generated + operations)
  const tags = collectTagsFromPaths(paths);

  const spec = {
    ...SPEC_HEADER,
    tags: Array.from(tags).sort().map((name) => ({ name })),
    components,
    paths,
  };
  return spec;
}

// ---------------------------------------------------------------------------
// Output helpers (deterministic YAML + JS)
// ---------------------------------------------------------------------------

function writeYamlDeterministic(filePath, obj) {
  const dumped = yaml.dump(obj, {
    sortKeys: (a, b) => a.localeCompare(b),
    lineWidth: 100,
    noRefs: true,
    quotingType: "'",
  });
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, dumped);
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('gen-spec: starting generation');

  // Stage 1: LOAD
  const { entities, components, operations } = loadDeclarations();
  console.log(
    `gen-spec: loaded ${entities.length} entities, ${components.length} components, ${operations.length} operations`
  );

  // Stage 2: PAIR
  const pairs = pairEntities(entities);

  // Stage 3: RESOLVE
  resolveRefs(pairs, components);

  // Stage 4: EMIT
  const entitySchemaOutputs = [];
  for (const { decl, model } of pairs) {
    const fieldMap = modelToFieldMap(model);
    applyFieldOverrides(fieldMap, decl);
    const schemas = emitEntitySchemas(decl.entity, fieldMap, decl);
    entitySchemaOutputs.push({ decl, schemas });
    writeYamlDeterministic(
      path.join(BUILD_SCHEMAS_DIR, `${decl.entity}.yaml`),
      { components: { schemas } }
    );
    console.log(`gen-spec: emitted schemas for ${decl.entity}`);
  }

  const componentSchemaOutputs = [];
  for (const { decl } of components) {
    const schemas = emitComponentSchema(decl);
    componentSchemaOutputs.push({ decl, schemas });
    writeYamlDeterministic(
      path.join(BUILD_SCHEMAS_DIR, `${decl.component}.yaml`),
      { components: { schemas } }
    );
    console.log(`gen-spec: emitted component ${decl.component}`);
  }

  // Joi
  const joiSource = emitJoiFile(pairs);
  writeFile(GENERATED_JOI_PATH, joiSource);
  console.log(`gen-spec: emitted Joi to ${path.relative(ROOT, GENERATED_JOI_PATH)}`);

  // Stage 5: ASSEMBLE
  const spec = assembleSpec(entitySchemaOutputs, componentSchemaOutputs, operations);
  writeYamlDeterministic(BUILD_SPEC_PATH, spec);
  console.log(`gen-spec: assembled spec at ${path.relative(ROOT, BUILD_SPEC_PATH)}`);

  console.log('gen-spec: done');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('gen-spec FAILED:', err.message);
    process.exit(1);
  }
}

module.exports = { main };
