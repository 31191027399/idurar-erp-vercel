const { globSync } = require('glob');
const fs = require('fs');
const path = require('path');
const { generate: uniqueId } = require('shortid');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const mongoose = require('mongoose');

const shouldClean = process.argv.includes('--clean');

const DEFAULT_COUNTS = {
  clients: 20,
  quotes: 20,
  invoices: 20,
  payments: 20,
};

const COMPANY_NAMES = [
  'Blue Orchid Studio',
  'Mekong Retail Group',
  'Lotus Harbor Logistics',
  'Saigon Craft House',
  'Delta Fresh Foods',
  'Urban Nest Interiors',
  'Bamboo Peak Ventures',
  'Sunrise Wellness Clinic',
  'Golden River Trading',
  'Cloud Nine Media',
];

const SERVICE_CATALOG = [
  { itemName: 'ERP onboarding package', description: 'Initial process mapping and account setup', price: 1200 },
  { itemName: 'Workflow implementation sprint', description: 'Custom workflow and dashboard setup', price: 1800 },
  { itemName: 'Monthly support retainer', description: 'Priority support for finance and operations teams', price: 300 },
  { itemName: 'POS rollout package', description: 'Outlet configuration and cashier training', price: 650 },
  { itemName: 'Inventory audit session', description: 'Stock audit and reconciliation workshop', price: 420 },
  { itemName: 'Reporting automation', description: 'Finance and sales report automation bundle', price: 950 },
];

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

function normalizeCounts(counts = {}) {
  return {
    clients: Math.max(1, Number(counts.clients ?? DEFAULT_COUNTS.clients)),
    quotes: Math.max(0, Number(counts.quotes ?? DEFAULT_COUNTS.quotes)),
    invoices: Math.max(0, Number(counts.invoices ?? DEFAULT_COUNTS.invoices)),
    payments: Math.max(0, Number(counts.payments ?? DEFAULT_COUNTS.payments)),
  };
}

async function resolveOwner(ownerAdmin) {
  const Admin = mongoose.model('Admin');

  if (ownerAdmin?._id) {
    return ownerAdmin;
  }

  const existingOwner =
    (await Admin.findOne({ role: 'owner', removed: false }).exec()) ||
    (await Admin.findOne({ removed: false }).exec());

  if (existingOwner) {
    return existingOwner;
  }

  const AdminPassword = mongoose.model('AdminPassword');
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@admin.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const admin = await new Admin({
    email,
    name: process.env.SEED_ADMIN_NAME || 'IDURAR',
    surname: process.env.SEED_ADMIN_SURNAME || 'Admin',
    enabled: true,
    role: 'owner',
    removed: false,
  }).save();

  const salt = uniqueId();
  const passwordHash = new AdminPassword().generateHash(salt, password);

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

function buildItems(seedIndex) {
  const primary = SERVICE_CATALOG[seedIndex % SERVICE_CATALOG.length];
  const secondary = SERVICE_CATALOG[(seedIndex + 1) % SERVICE_CATALOG.length];
  const quantity = (seedIndex % 3) + 1;

  return [
    {
      itemName: primary.itemName,
      description: primary.description,
      quantity,
      price: primary.price,
      total: quantity * primary.price,
    },
    {
      itemName: secondary.itemName,
      description: secondary.description,
      quantity: 1,
      price: secondary.price,
      total: secondary.price,
    },
  ];
}

function summarize(items, taxRate = 0, discount = 0) {
  const subTotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxable = subTotal - discount;
  const taxTotal = Number(((taxable * taxRate) / 100).toFixed(2));
  const total = Number((taxable + taxTotal).toFixed(2));
  return { subTotal, taxTotal, total };
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

async function seedClients(owner, clientCount) {
  const Client = mongoose.model('Client');
  const docs = Array.from({ length: clientCount }, (_, index) => {
    const companyName = COMPANY_NAMES[index % COMPANY_NAMES.length];
    const serial = index + 1;

    return {
      name: clientCount <= COMPANY_NAMES.length ? companyName : `${companyName} ${serial}`,
      phone: `+84 90${String(1000000 + serial).slice(-7)}`,
      country: 'Vietnam',
      address: `${10 + serial} Nguyen Hue Boulevard, District ${(serial % 7) + 1}`,
      email: `finance${serial}@demo-client${serial}.vn`,
      createdBy: owner._id,
      assigned: owner._id,
      removed: false,
      enabled: true,
    };
  });

  return Client.insertMany(docs);
}

async function seedQuotes(owner, clients, quoteCount) {
  const Quote = mongoose.model('Quote');
  const docs = [];

  for (let index = 0; index < quoteCount; index += 1) {
    const items = buildItems(index);
    const quoteSummary = summarize(items, 10, 0);
    const client = clients[index % clients.length];

    docs.push({
      createdBy: owner._id,
      number: index + 1,
      year: 2026,
      date: new Date(Date.UTC(2026, 3, 1 + index)),
      expiredDate: new Date(Date.UTC(2026, 3, 10 + index)),
      client: client._id,
      items,
      taxRate: 10,
      subTotal: quoteSummary.subTotal,
      taxTotal: quoteSummary.taxTotal,
      total: quoteSummary.total,
      currency: 'USD',
      discount: 0,
      status: 'accepted',
      notes: `Accepted commercial quote ${index + 1} for ${client.name}.`,
      removed: false,
    });
  }

  return Quote.insertMany(docs);
}

async function seedInvoices(owner, clients, quotes, invoiceCount) {
  const Invoice = mongoose.model('Invoice');
  const invoices = [];

  for (let index = 0; index < invoiceCount; index += 1) {
    const items = buildItems(index + 10);
    const discount = index % 2 === 0 ? 100 : 0;
    const taxRate = index % 3 === 0 ? 10 : 0;
    const invoiceSummary = summarize(items, taxRate, discount);
    const client = clients[index % clients.length];
    const linkedQuote = quotes.length ? quotes[index % quotes.length] : null;
    const issuedDate = new Date(Date.UTC(2026, 3, 3 + index));

    invoices.push({
      createdBy: owner._id,
      number: index + 1,
      year: 2026,
      content: `Seeded invoice ${index + 1}`,
      date: issuedDate,
      expiredDate: new Date(Date.UTC(2026, 3, 17 + index)),
      client: client._id,
      converted: linkedQuote
        ? {
            from: 'quote',
            quote: linkedQuote._id,
          }
        : undefined,
      items,
      taxRate,
      subTotal: invoiceSummary.subTotal,
      taxTotal: invoiceSummary.taxTotal,
      total: invoiceSummary.total,
      currency: 'USD',
      credit: 0,
      discount,
      payment: [],
      paymentStatus: 'unpaid',
      approved: true,
      status: 'sent',
      notes: `Seeded invoice ${index + 1} for ${client.name}.`,
      removed: false,
    });
  }

  return Invoice.insertMany(invoices);
}

async function seedPayments(owner, invoices, paymentCount) {
  const Payment = mongoose.model('Payment');
  if (!invoices.length || paymentCount === 0) {
    return [];
  }

  const docs = [];
  for (let index = 0; index < paymentCount; index += 1) {
    const invoice = invoices[index % invoices.length];
    const ratio = index % 2 === 0 ? 0.5 : 1;
    const amount = Number((invoice.total * ratio).toFixed(2));

    docs.push({
      createdBy: owner._id,
      number: index + 1,
      client: invoice.client._id || invoice.client,
      invoice: invoice._id,
      date: new Date(Date.UTC(2026, 3, 8 + index)),
      amount,
      currency: invoice.currency,
      ref: `PMT-${String(index + 1).padStart(4, '0')}`,
      description: `Seeded payment ${index + 1} for invoice ${invoice.number}`,
      removed: false,
    });
  }

  return Payment.insertMany(docs);
}

async function reconcileInvoices(invoices, payments) {
  const Invoice = mongoose.model('Invoice');
  const paymentMap = new Map();

  for (const payment of payments) {
    const key = String(payment.invoice._id || payment.invoice);
    const current = paymentMap.get(key) || [];
    current.push(payment);
    paymentMap.set(key, current);
  }

  for (const invoice of invoices) {
    const linkedPayments = paymentMap.get(String(invoice._id)) || [];
    const paidAmount = linkedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const remaining = Number((invoice.total - paidAmount).toFixed(2));

    let paymentStatus = 'unpaid';
    if (paidAmount > 0 && remaining > 0) paymentStatus = 'partially';
    if (remaining <= 0) paymentStatus = 'paid';

    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          payment: linkedPayments.map((payment) => payment._id),
          credit: Math.max(remaining, 0),
          paymentStatus,
          updated: new Date(),
        },
      }
    ).exec();
  }
}

async function seedSettings(primaryClientId, ownerEmail, counts) {
  const Setting = mongoose.model('Setting');
  const settingsFiles = globSync(path.join(__dirname, 'defaultSettings/**/*.json'));

  for (const filePath of settingsFiles) {
    const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const setting of settings) {
      await new Setting(setting).save();
    }
  }

  const overrides = {
    idurar_app_email: ownerEmail,
    idurar_app_company_email: ownerEmail,
    company_email: ownerEmail,
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
    last_invoice_number: counts.invoices,
    last_quote_number: counts.quotes,
    last_payment_number: counts.payments,
    last_offer_number: 0,
  };

  for (const [settingKey, settingValue] of Object.entries(overrides)) {
    await Setting.updateOne({ settingKey }, { $set: { settingValue } }).exec();
  }
}

async function cleanDatabase({ preserveAdmins = false } = {}) {
  const modelsToClear = ['Payment', 'Invoice', 'Quote', 'Client', 'PaymentMode', 'Taxes', 'Setting'];

  if (!preserveAdmins) {
    modelsToClear.push('AdminPassword', 'Admin');
  }

  for (const modelName of modelsToClear) {
    await mongoose.model(modelName).deleteMany({});
  }

  console.log('Cleaned ERP collections');
}

async function seedDatabase({ clean = false, ownerAdmin = null, counts = {} } = {}) {
  await connect();
  loadModels();

  if (clean) {
    await cleanDatabase({ preserveAdmins: true });
  }

  const normalizedCounts = normalizeCounts(counts);
  const owner = await resolveOwner(ownerAdmin);
  await seedDefaults();
  const clients = await seedClients(owner, normalizedCounts.clients);
  const quotes = await seedQuotes(owner, clients, normalizedCounts.quotes);
  const invoices = await seedInvoices(owner, clients, quotes, normalizedCounts.invoices);
  const payments = await seedPayments(owner, invoices, normalizedCounts.payments);
  await reconcileInvoices(invoices, payments);
  await seedSettings(clients[0]._id, owner.email, normalizedCounts);

  return {
    owner: { email: owner.email, role: owner.role },
    summary: normalizedCounts,
  };
}

async function runSeed({ clean = false, counts = {} } = {}) {
  try {
    const result = await seedDatabase({ clean, counts });
    console.log('Seed completed successfully');
    console.log(`Owner preserved: ${result.owner.email} (${result.owner.role})`);
    console.log(
      `Seeded ${result.summary.clients} clients, ${result.summary.quotes} quotes, ${result.summary.invoices} invoices, ${result.summary.payments} payments.`
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
    await cleanDatabase({ preserveAdmins: true });
    console.log('Database cleaned successfully');
  } catch (error) {
    console.error('Clean failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

module.exports = {
  DEFAULT_COUNTS,
  cleanDatabase,
  seedDatabase,
  runSeed,
  runCleanOnly,
};

if (require.main === module) {
  runSeed({ clean: shouldClean });
}
