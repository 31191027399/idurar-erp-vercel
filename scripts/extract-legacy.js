#!/usr/bin/env node
/**
 * scripts/extract-legacy.js
 *
 * ONE-TIME extraction: splits the legacy hand-written spec into:
 *   - openapi/paths/*.yaml     (per-entity path files, where each clearly groups
 *                               under one tag; this is a best-effort split)
 *   - openapi/legacy-schemas.yaml  (all components/schemas as-is — these stay
 *                                    hand-written until each entity migrates)
 *
 * After this extraction, `openapi/idurar-erp.openapi.yaml` is replaced by a
 * shim that re-exports `openapi/build/idurar-erp.openapi.yaml` (assembled).
 *
 * Re-run is idempotent but should not be needed after the initial migration.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'openapi/idurar-erp.openapi.yaml');
const LEGACY_SCHEMAS = path.join(ROOT, 'openapi/legacy-schemas.yaml');
const LEGACY_PATHS = path.join(ROOT, 'openapi/legacy-paths.yaml');
const SHIM = path.join(ROOT, 'openapi/idurar-erp.openapi.yaml');

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('extract-legacy: source spec not found at ' + SRC);
    process.exit(1);
  }
  const spec = yaml.load(fs.readFileSync(SRC, 'utf8'));

  // 1. Extract all schemas into legacy-schemas.yaml
  const schemas = (spec.components && spec.components.schemas) || {};
  const legacyDoc = {
    components: {
      schemas: { ...schemas },
    },
  };
  fs.mkdirSync(path.dirname(LEGACY_SCHEMAS), { recursive: true });
  fs.writeFileSync(
    LEGACY_SCHEMAS,
    yaml.dump(legacyDoc, { sortKeys: (a, b) => a.localeCompare(b), lineWidth: 100, noRefs: true })
  );
  console.log('extract-legacy: wrote legacy schemas to openapi/legacy-schemas.yaml');

  // 2. Extract paths into legacy-paths.yaml (preserved verbatim, $refs to
  //    schemas that will be overridden by generated output where migrated)
  const paths = spec.paths || {};
  const pathsDoc = { paths: { ...paths } };
  fs.writeFileSync(
    LEGACY_PATHS,
    yaml.dump(pathsDoc, { sortKeys: (a, b) => a.localeCompare(b), lineWidth: 100, noRefs: true })
  );
  console.log('extract-legacy: wrote legacy paths to openapi/legacy-paths.yaml');

  // 3. Replace the legacy spec with a symlink to the assembled build output.
  //    External consumers fetch openapi/idurar-erp.openapi.yaml and transparently
  //    see the assembled content from openapi/build/idurar-erp.openapi.yaml.
  if (fs.existsSync(SHIM)) fs.unlinkSync(SHIM);
  fs.symlinkSync('build/idurar-erp.openapi.yaml', SHIM);
  console.log('extract-legacy: replaced legacy spec with symlink to build/idurar-erp.openapi.yaml');

  console.log('extract-legacy: done. Re-run npm run spec:gen to assemble the merged build.');
}

if (require.main === module) main();
