// Contract for the Taxes entity. Source of truth for:
//   - openapi/build/schemas/Taxes.yaml          (generated)
//   - entitySchemas.js 'taxes' entry            (generated Joi)
//
// Co-located with Taxes.js (storage schema). This file describes the API
// surface; Taxes.js describes storage. They are paired by basename.

module.exports = {
  entity: 'Taxes',
  description: 'A tax rate applicable to invoice line items.',

  // What the client may send on POST /api/taxes/create
  create: {
    required: ['taxName', 'taxValue'],
    optional: ['isDefault', 'enabled'],
    // Present on the model but server-controlled — client can NEVER set these
    readOnly: ['_id', 'removed', 'createdAt', 'updatedAt'],
    // Present on the model but not exposed through this API surface
    ignore: ['__v'],
  },

  // What the client may send on PATCH /api/taxes/update/{id}
  // Omitted fields inherit from `create` (as optional, with readOnly excluded)
  update: {
    immutable: [], // nothing is locked after creation
    required: [], // partial update — nothing forced
  },

  // GET response shape. Refs that arrive populated vs as ids would go here.
  // Taxes has no refs, so this is minimal.
  response: {
    populated: [],
  },

  // Per-field overrides where the generator needs help beyond Mongoose types
  fields: {
    // Quirk surfacing: taxValue is a String in the model, but semantically
    // a percentage. The declaration documents this honestly instead of
    // hiding it behind a lossy type.
    taxValue: {
      type: 'string',
      description:
        'Tax rate as a string (e.g. "5", "7.5"). Stored as string per model; clients should parse for arithmetic.',
      example: '7.5',
    },
    isDefault: {
      description: 'Whether this tax rate is the default applied to new invoices.',
    },
    enabled: {
      description: 'Soft-disable a tax rate without deleting it.',
    },
    taxName: {
      description: 'Human-readable name of the tax (e.g. "VAT", "Sales Tax").',
      example: 'VAT',
    },
  },

  // Strict stance: Taxes is small and well-understood, graduates to strict
  // immediately. Unknown fields will be rejected with HTTP 400.
  additionalProperties: false,

  tags: ['Taxes'],
};
