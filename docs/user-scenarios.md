# IDURAR ERP User Scenarios

This guide explains the system in business terms for non-technical users.

## Who Uses This System

- Business owner
- Manager
- Finance or operations staff
- Sales staff

## What You Can Do

- Sign in to the ERP
- Manage users
- Add customers
- Prepare and send quotes
- Convert quotes into invoices
- Record customer payments
- Maintain taxes, payment modes, and company settings
- Reset demo data from the maintenance screen if you are the owner

## Scenario 1: Log In

1. Open the ERP website.
2. Enter your email and password.
3. Click the login button.
4. After login, you will see the main dashboard and the left-side menu.

If you forgot your password:

1. Use the password recovery option.
2. Enter your email.
3. Check your inbox for a reset link.
4. Set a new password and sign in again.

## Scenario 2: Set Up the Company

This is usually done once by the owner.

1. Open `Settings`.
2. Update the company name, email, phone number, address, and website.
3. Upload the company logo.
4. Set currency and money format preferences.
5. Save the changes.

Why this matters:

- The company details appear in quotes, invoices, and emails.

## Scenario 3: Manage Team Members

Use `Users` when you want to add or control internal staff access.

Typical flow:

1. Open `Users`.
2. Click `Add New User`.
3. Fill in name, surname, email, role, and active status.
4. Save the user.
5. Update or disable users later if needed.

Common roles:

- `owner`: full control
- `admin`: high-level administration
- `manager`: day-to-day management
- `employee`: standard staff access

## Scenario 4: Add a Customer

Use `Customers` to store company or client information.

Typical flow:

1. Open `Customers`.
2. Click create or add customer.
3. Enter the customer name and contact details.
4. Save the record.

This customer can then be selected inside quotes, invoices, and payments.

## Scenario 5: Create a Quote

Use `Quote` when you want to propose pricing before billing.

Typical flow:

1. Open `Quote`.
2. Create a new quote.
3. Select a customer.
4. Add line items, quantities, prices, taxes, and notes.
5. Save the quote.
6. Send or share the quote with the customer.

Business meaning:

- A quote is an offer or proposal.
- It is not yet final billing.

## Scenario 6: Convert a Quote to an Invoice

Once the customer accepts the quote:

1. Open the quote record.
2. Use the convert action if available.
3. Review the generated invoice.
4. Save or send the invoice.

Business meaning:

- The quote becomes a billable invoice.
- This keeps the sales flow connected from proposal to payment collection.

## Scenario 7: Create an Invoice Directly

Sometimes you may skip quotes and bill immediately.

Typical flow:

1. Open `Invoices`.
2. Create a new invoice.
3. Select the customer.
4. Add line items, tax, discount, due date, and notes.
5. Save and send the invoice.

Use this when:

- the price is already agreed
- recurring billing is needed
- the business is ready to collect payment

## Scenario 8: Record a Payment

Use `Payments` after the customer pays.

Typical flow:

1. Open the payment section or record payment from an invoice.
2. Select the customer and invoice.
3. Enter the amount, date, reference, and optional description.
4. Save the payment.

Result:

- The invoice payment status updates to unpaid, partially paid, or paid.

## Scenario 9: Maintain Taxes and Payment Modes

Use `Taxes` and `Payments Mode` to standardize billing options.

Examples:

- Add VAT 10%
- Add 0% tax for special cases
- Add bank transfer as the default payment mode
- Add cash for in-person transactions

This keeps quotes and invoices more consistent.

## Scenario 10: Use Demo Data Maintenance

This is mainly for demos, testing, or staging environments.

Owner-only tools let you:

- clear ERP records
- reseed linked demo data
- choose how many demo clients, quotes, invoices, and payments to create

Typical flow:

1. Open `Settings`.
2. Open the maintenance section.
3. Choose the number of demo records to create.
4. Run `Clean ERP Data` or `Clean And Seed Demo Data`.

When to use it:

- preparing a fresh demo
- resetting a test environment
- rebuilding sample ERP data quickly

## Scenario 11: Download or Share Documents

The system supports document and public file access.

Typical uses:

- download invoice PDF
- download quote PDF
- access public files that have already been published by the app

## Recommended Day-to-Day Flow

For most businesses, the common process is:

1. Add customer
2. Create quote
3. Customer accepts quote
4. Convert quote to invoice
5. Send invoice
6. Record payment
7. Track paid and unpaid balances

## Best Practices

- Keep customer records complete before creating quotes or invoices.
- Review taxes and currency settings before sending documents.
- Use roles carefully so only trusted users can access owner features.
- Use maintenance tools only in demo or controlled environments.
- Record payments promptly so invoice balances stay accurate.
