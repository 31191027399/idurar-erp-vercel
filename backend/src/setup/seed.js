const { globSync } = require('glob');
const fs = require('fs');
const path = require('path');
const { generate: uniqueId } = require('shortid');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const mongoose = require('mongoose');

const shouldClean = process.argv.includes('--clean');

const seedConfig = {
  owner: {
    email: process.env.SEED_ADMIN_EMAIL || 'admin@admin.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'admin123',
    name: process.env.SEED_ADMIN_NAME || 'IDURAR',
    surname: process.env.SEED_ADMIN_SURNAME || 'Admin',
    role: 'owner',
  },
  manager: {
    email: process.env.SEED_MANAGER_EMAIL || 'manager@idurar.com',
    password: process.env.SEED_MANAGER_PASSWORD || 'manager123',
    name: 'Olivia',
    surname: 'Nguyen',
    role: 'manager',
  },
};

async function connect() {
  if (!process.env.DATABASE) {
    throw new Error('Missing DATABASE environment variable');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(process.env.DATABASE);
}

function loadModels() {
  const modelFiles = globSync(path.join(__dirname, '../models/**/*.js'));
  for (const file of modelFiles) {
    require(file);
  }
}

function createPasswordHash(AdminPassword, password) {
  const salt = uniqueId();
  const passwordHash = new AdminPassword().generateHash(salt, password);
  return { salt, passwordHash };
}

async function createAdminAccount(adminData) {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');
  const existingAdmin = await Admin.findOne({ email: adminData.email }).exec();

  if (existingAdmin) {
    throw new Error(`Admin with email ${adminData.email} already exists. Run with --clean or change email.`);
  }

  const admin = await new Admin({
    email: adminData.email,
    name: adminData.name,
    surname: adminData.surname,
    enabled: true,
    role: adminData.role,
    removed: false,
  }).save();

  const { salt, passwordHash } = createPasswordHash(AdminPassword, adminData.password);

  await new AdminPassword({
    user: admin._id,
    password: passwordHash,
    emailVerified: true,
    salt,
    authType: 'email',
    removed: false,
    loggedSessions: [],
  }).save();

  return admin;
}

async function seedSettings(primaryClientId) {
  const Setting = mongoose.model('Setting');
  const settingsFiles = globSync(path.join(__dirname, 'defaultSettings/**/*.json'));

  for (const filePath of settingsFiles) {
    const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const setting of settings) {
      await new Setting(setting).save();
    }
  }

  const overrides = {
    idurar_app_email: seedConfig.owner.email,
    idurar_app_company_email: seedConfig.owner.email,
    company_email: seedConfig.owner.email,
    company_name: 'IDURAR Demo Company',
    company_country: 'Vietnam',
    company_state: 'Ho Chi Minh City',
    company_address: '42 Nguyen Hue Boulevard',
    company_phone: '+84 28 1234 5678',
    company_website: 'https://idurar-erp-vercel.vercel.app',
    default_currency_code: 'USD',
    currency_name: 'US Dollar',
    currency_symbol: '$',
    idurar_app_country: 'Vietnam',
    idurar_app_timezone: 'Asia/Ho_Chi_Minh',
    pos_default_client: String(primaryClientId),
    last_invoice_number: 2,
    last_quote_number: 1,
    last_payment_number: 2,
    last_offer_number: 0,
  };

  for (const [settingKey, settingValue] of Object.entries(overrides)) {
    await Setting.updateOne({ settingKey }, { $set: { settingValue } }).exec();
  }
}

async function seedDefaults() {
  const PaymentMode = mongoose.model('PaymentMode');
  const Taxes = mongoose.model('Taxes');

  await PaymentMode.insertMany([
    {
      name: 'Bank Transfer',
      description: 'Primary bank transfer payment mode',
      isDefault: true,
      removed: false,
      enabled: true,
    },
    {
      name: 'Cash',
      description: 'Cash payment collected at office',
      isDefault: false,
      removed: false,
      enabled: true,
    },
  ]);

  await Taxes.insertMany([
    { taxName: 'VAT 10%', taxValue: '10', isDefault: true, removed: false, enabled: true },
    { taxName: 'Tax 0%', taxValue: '0', isDefault: false, removed: false, enabled: true },
  ]);
}

async function seedClients(owner, manager) {
  const Client = mongoose.model('Client');
  return Client.insertMany([
    {
      name: 'Blue Orchid Studio',
      phone: '+84 901 111 222',
      country: 'Vietnam',
      address: '12 Le Loi Street, District 1',
      email: 'finance@blueorchid.vn',
      createdBy: owner._id,
      assigned: manager._id,
      removed: false,
      enabled: true,
    },
    {
      name: 'Mekong Retail Group',
      phone: '+84 902 333 444',
      country: 'Vietnam',
      address: '88 Tran Hung Dao, District 5',
      email: 'accounts@mekongretail.vn',
      createdBy: owner._id,
      assigned: owner._id,
      removed: false,
      enabled: true,
    },
  ]);
}

function buildItems(lines) {
  return lines.map((line) => ({
    itemName: line.itemName,
    description: line.description,
    quantity: line.quantity,
    price: line.price,
    total: line.quantity * line.price,
  }));
}

function summarize(items, taxRate = 0, discount = 0) {
  const subTotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxable = subTotal - discount;
  const taxTotal = Number(((taxable * taxRate) / 100).toFixed(2));
  const total = taxable + taxTotal;
  return { subTotal, taxTotal, total };
}

async function seedSales(owner, clients) {
  const Quote = mongoose.model('Quote');
  const Invoice = mongoose.model('Invoice');
  const Payment = mongoose.model('Payment');

  const quoteItems = buildItems([
    {
      itemName: 'ERP onboarding package',
      description: 'Initial process mapping and account setup',
      quantity: 1,
      price: 1200,
    },
    {
      itemName: 'User training',
      description: 'Two remote training sessions for accounting team',
      quantity: 2,
      price: 250,
    },
  ]);
  const quoteSummary = summarize(quoteItems, 10, 0);

  const quote = await new Quote({
    createdBy: owner._id,
    number: 1,
    year: 2026,
    date: new Date('2026-04-01T09:00:00.000Z'),
    expiredDate: new Date('2026-04-15T09:00:00.000Z'),
    client: clients[0]._id,
    items: quoteItems,
    taxRate: 10,
    subTotal: quoteSummary.subTotal,
    taxTotal: quoteSummary.taxTotal,
    total: quoteSummary.total,
    currency: 'USD',
    discount: 0,
    status: 'accepted',
    notes: 'Approved by client and ready for invoicing.',
    removed: false,
  }).save();

  const invoiceOneItems = buildItems([
    {
      itemName: 'Implementation sprint',
      description: 'Custom workflow and dashboard setup',
      quantity: 1,
      price: 1800,
    },
    {
      itemName: 'Monthly support',
      description: 'Priority email support for April',
      quantity: 1,
      price: 300,
    },
  ]);
  const invoiceOneSummary = summarize(invoiceOneItems, 10, 100);

  const invoiceOne = await new Invoice({
    createdBy: owner._id,
    number: 1,
    year: 2026,
    content: 'April implementation invoice',
    date: new Date('2026-04-03T09:00:00.000Z'),
    expiredDate: new Date('2026-04-17T09:00:00.000Z'),
    client: clients[0]._id,
    converted: {
      from: 'quote',
      quote: quote._id,
    },
    items: invoiceOneItems,
    taxRate: 10,
    subTotal: invoiceOneSummary.subTotal,
    taxTotal: invoiceOneSummary.taxTotal,
    total: invoiceOneSummary.total,
    currency: 'USD',
    credit: 800,
    discount: 100,
    paymentStatus: 'partially',
    approved: true,
    status: 'sent',
    notes: 'Client paid deposit, remaining balance due.',
    removed: false,
  }).save();

  const invoiceTwoItems = buildItems([
    {
      itemName: 'POS rollout package',
      description: 'Outlet configuration for 3 locations',
      quantity: 3,
      price: 650,
    },
  ]);
  const invoiceTwoSummary = summarize(invoiceTwoItems, 0, 0);

  const invoiceTwo = await new Invoice({
    createdBy: owner._id,
    number: 2,
    year: 2026,
    content: 'Retail rollout invoice',
    date: new Date('2026-04-05T09:00:00.000Z'),
    expiredDate: new Date('2026-04-20T09:00:00.000Z'),
    client: clients[1]._id,
    items: invoiceTwoItems,
    taxRate: 0,
    subTotal: invoiceTwoSummary.subTotal,
    taxTotal: invoiceTwoSummary.taxTotal,
    total: invoiceTwoSummary.total,
    currency: 'USD',
    credit: invoiceTwoSummary.total,
    discount: 0,
    paymentStatus: 'paid',
    approved: true,
    status: 'sent',
    notes: 'Paid in full on receipt.',
    removed: false,
  }).save();

  const payments = await Payment.insertMany([
    {
      createdBy: owner._id,
      number: 1,
      client: clients[0]._id,
      invoice: invoiceOne._id,
      date: new Date('2026-04-08T09:00:00.000Z'),
      amount: 800,
      currency: 'USD',
      ref: 'DEP-APR-001',
      description: 'Initial deposit for implementation sprint',
      removed: false,
    },
    {
      createdBy: owner._id,
      number: 2,
      client: clients[1]._id,
      invoice: invoiceTwo._id,
      date: new Date('2026-04-06T09:00:00.000Z'),
      amount: invoiceTwoSummary.total,
      currency: 'USD',
      ref: 'POS-APR-002',
      description: 'Full payment for retail rollout package',
      removed: false,
    },
  ]);

  await Invoice.updateOne(
    { _id: invoiceOne._id },
    { $set: { payment: [payments[0]._id], updated: new Date() } }
  ).exec();
  await Invoice.updateOne(
    { _id: invoiceTwo._id },
    { $set: { payment: [payments[1]._id], updated: new Date() } }
  ).exec();
}

async function cleanDatabase({ preserveAdmins = false } = {}) {
  const modelsToClear = [
    'Payment',
    'Invoice',
    'Quote',
    'Client',
    'PaymentMode',
    'Taxes',
    'Setting',
  ];

  if (!preserveAdmins) {
    modelsToClear.push('AdminPassword', 'Admin');
  }

  for (const modelName of modelsToClear) {
    await mongoose.model(modelName).deleteMany({});
  }

  console.log('Cleaned ERP collections');
}

async function seedDatabase({ clean = false } = {}) {
  await connect();
  loadModels();

  if (clean) {
    await cleanDatabase();
  }

  const owner = await createAdminAccount(seedConfig.owner);
  const manager = await createAdminAccount(seedConfig.manager);
  await seedDefaults();
  const clients = await seedClients(owner, manager);
  await seedSettings(clients[0]._id);
  await seedSales(owner, clients);

  return {
    owner: { email: seedConfig.owner.email, password: seedConfig.owner.password },
    manager: { email: seedConfig.manager.email, password: seedConfig.manager.password },
    summary: {
      clients: clients.length,
      quotes: 1,
      invoices: 2,
      payments: 2,
    },
  };
}

async function runSeed({ clean = false } = {}) {
  try {
    const result = await seedDatabase({ clean });

    console.log('Seed completed successfully');
    console.log(`Owner login: ${result.owner.email} / ${result.owner.password}`);
    console.log(`Manager login: ${result.manager.email} / ${result.manager.password}`);
    console.log(
      `Seeded ${result.summary.clients} clients, ${result.summary.quotes} quote, ${result.summary.invoices} invoices, ${result.summary.payments} payments.`
    );
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

async function runCleanOnly() {
  try {
    await connect();
    loadModels();
    await cleanDatabase();
    console.log('Database cleaned successfully');
  } catch (error) {
    console.error('Clean failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

module.exports = {
  cleanDatabase,
  seedDatabase,
  runSeed,
  runCleanOnly,
};

if (require.main === module) {
  runSeed({ clean: shouldClean });
}
