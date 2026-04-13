const { cleanDatabase, seedDatabase } = require('../../../setup/seed');

function ensureOwner(req) {
  if (!req.admin || req.admin.role !== 'owner') {
    const error = new Error('Only the account owner can run maintenance actions.');
    error.status = 403;
    throw error;
  }
}

async function clean(req, res) {
  ensureOwner(req);
  await cleanDatabase({ preserveAdmins: true });

  return res.status(200).json({
    success: true,
    result: null,
    message: 'ERP data cleaned successfully.',
  });
}

async function seed(req, res) {
  ensureOwner(req);
  const cleanFirst = req.body?.clean !== false;
  const counts = req.body?.counts || {};
  const result = await seedDatabase({ clean: cleanFirst, ownerAdmin: req.admin, counts });

  return res.status(200).json({
    success: true,
    result,
    message: cleanFirst
      ? 'ERP demo data cleaned and seeded successfully.'
      : 'ERP demo data seeded successfully.',
  });
}

module.exports = { clean, seed };
