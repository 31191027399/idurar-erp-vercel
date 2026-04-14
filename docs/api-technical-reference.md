# IDURAR ERP API Technical Reference

This document is based on the current backend implementation under [`backend/src/app.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/app.js), [`backend/src/routes/coreRoutes`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/routes/coreRoutes), and [`backend/src/routes/appRoutes/appApi.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/routes/appRoutes/appApi.js).

## Base Paths

- Authenticated and unauthenticated API: `/api`
- PDF download: `/download`
- Public file access: `/public`

## Authentication Model

- Login returns a JWT in `result.token`.
- Protected routes expect `Authorization: Bearer <token>`.
- All `/api` routes except `login`, `forgetpassword`, and `resetpassword` are protected.

## Common Response Shape

Most endpoints return:

```json
{
  "success": true,
  "result": {},
  "message": "Human-readable message"
}
```

Paginated list endpoints also return:

```json
{
  "success": true,
  "result": [],
  "pagination": {
    "page": 1,
    "pages": 3,
    "count": 27
  },
  "message": "Successfully found all documents"
}
```

## Common Query Parameters

Used mainly by `list`, `search`, `filter`, and `summary`.

| Parameter | Meaning |
| --- | --- |
| `page` | Page number for paginated list. Default `1`. |
| `items` | Page size for paginated list. Default `10`. |
| `sortBy` | Sort field. Default `enabled` in generic list handler. |
| `sortValue` | Sort direction, typically `1` or `-1`. |
| `q` | Search text. |
| `fields` | Comma-separated searchable fields, for example `name,email`. |
| `filter` | Field name used by `filter` or `summary`. |
| `equal` | Exact value used with `filter`. |

## Auth Endpoints

| Method | Path | Auth | Purpose | Typical body |
| --- | --- | --- | --- | --- |
| `POST` | `/api/login` | No | Login admin user | `{ "email": "admin@admin.com", "password": "admin123", "remember": true }` |
| `POST` | `/api/forgetpassword` | No | Generate reset token and send reset email | `{ "email": "admin@admin.com" }` |
| `POST` | `/api/resetpassword` | No | Reset password using reset token | `{ "userId": "...", "resetToken": "...", "password": "new-password" }` |
| `POST` | `/api/logout` | Yes | Logout current token or all tokens if token missing | No body required |

## Admin Endpoints

All of these require a bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/admin/create` | Create admin user |
| `GET` | `/api/admin/read/:id` | Read admin by id |
| `PATCH` | `/api/admin/update/:id` | Update admin profile fields |
| `DELETE` | `/api/admin/delete/:id` | Soft-delete admin |
| `GET` | `/api/admin/list` | Paginated admin list |
| `GET` | `/api/admin/search` | Search admins |
| `PATCH` | `/api/admin/password-update/:id` | Update another admin password |
| `PATCH` | `/api/admin/profile/password` | Update current admin password |
| `PATCH` | `/api/admin/profile/update` | Update current admin profile and optional photo upload |
| `POST` | `/api/admin/maintenance/clean` | Clear ERP transactional/config data while preserving admins |
| `POST` | `/api/admin/maintenance/seed` | Reseed ERP demo data |

### Admin Payload Notes

- Admin schema fields come from [`backend/src/models/coreModels/Admin.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/coreModels/Admin.js).
- Common writable fields:
  - `email`
  - `name`
  - `surname`
  - `photo`
  - `enabled`
  - `role`
- Allowed roles:
  - `owner`
  - `admin`
  - `manager`
  - `employee`
  - `create_only`
  - `read_only`

### Maintenance Seed Body

```json
{
  "clean": true,
  "counts": {
    "clients": 20,
    "quotes": 20,
    "invoices": 20,
    "payments": 20
  }
}
```

## Setting Endpoints

All of these require a bearer token.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/setting/create` | Create setting |
| `GET` | `/api/setting/read/:id` | Read setting by id |
| `PATCH` | `/api/setting/update/:id` | Update setting by id |
| `GET` | `/api/setting/search` | Search settings |
| `GET` | `/api/setting/list` | Paginated settings list |
| `GET` | `/api/setting/listAll` | List all settings |
| `GET` | `/api/setting/filter` | Exact-match filter on settings |
| `GET` | `/api/setting/readBySettingKey/:settingKey` | Read setting by key |
| `GET` | `/api/setting/listBySettingKey` | Read multiple settings by key selection logic |
| `PATCH` | `/api/setting/updateBySettingKey/:settingKey?` | Update setting by key |
| `PATCH` | `/api/setting/upload/:settingKey?` | Upload image/file as a setting value |
| `PATCH` | `/api/setting/updateManySetting` | Bulk-update multiple settings |

### Setting Payload Notes

- Schema fields come from [`backend/src/models/coreModels/Setting.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/coreModels/Setting.js).
- Common fields:
  - `settingCategory`
  - `settingKey`
  - `settingValue`
  - `valueType`
  - `isPrivate`
  - `isCoreSetting`
  - `enabled`

## ERP Entity Endpoints

The app route builder creates the same CRUD surface for these entities:

- `client`
- `invoice`
- `payment`
- `paymentmode`
- `quote`
- `taxes`

### Standard Entity Endpoints

For each entity above:

| Method | Path pattern | Purpose |
| --- | --- | --- |
| `POST` | `/api/{entity}/create` | Create record |
| `GET` | `/api/{entity}/read/:id` | Read record by id |
| `PATCH` | `/api/{entity}/update/:id` | Update record |
| `DELETE` | `/api/{entity}/delete/:id` | Soft-delete record |
| `GET` | `/api/{entity}/search` | Regex search across chosen fields |
| `GET` | `/api/{entity}/list` | Paginated list |
| `GET` | `/api/{entity}/listAll` | Full list without pagination |
| `GET` | `/api/{entity}/filter` | Exact-match filter |
| `GET` | `/api/{entity}/summary` | Count total and filtered records |

### Special ERP Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/invoice/mail` | Email invoice |
| `POST` | `/api/payment/mail` | Email payment receipt/details |
| `POST` | `/api/quote/mail` | Declared by router pattern for quotes |
| `GET` | `/api/quote/convert/:id` | Declared by router pattern for converting quote |

### Important Note About Quote Special Routes

The router pattern declares `quote/mail` and `quote/convert/:id` in [`backend/src/routes/appRoutes/appApi.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/routes/appRoutes/appApi.js), but the current controller tree does not include a dedicated `quoteController` implementation alongside the invoice and payment custom controllers. Treat those two quote-special endpoints as repo-declared but implementation-sensitive.

## Main Entity Field Reference

These are the core fields exposed by the Mongoose schemas.

### Client

Source: [`backend/src/models/appModels/Client.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/Client.js)

- `name`
- `phone`
- `country`
- `address`
- `email`
- `createdBy`
- `assigned`
- `enabled`

### Quote

Source: [`backend/src/models/appModels/Quote.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/Quote.js)

- `createdBy`
- `number`
- `year`
- `content`
- `date`
- `expiredDate`
- `client`
- `items[]`
- `taxRate`
- `subTotal`
- `taxTotal`
- `total`
- `currency`
- `discount`
- `status`
- `notes`
- `files[]`

Quote `status` values:

- `draft`
- `pending`
- `sent`
- `accepted`
- `declined`
- `expired`
- `cancelled`

### Invoice

Source: [`backend/src/models/appModels/Invoice.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/Invoice.js)

- `createdBy`
- `number`
- `year`
- `content`
- `recurring`
- `date`
- `expiredDate`
- `client`
- `converted`
- `items[]`
- `taxRate`
- `subTotal`
- `taxTotal`
- `total`
- `currency`
- `credit`
- `discount`
- `payment[]`
- `paymentStatus`
- `isOverdue`
- `approved`
- `notes`
- `status`
- `files[]`

Invoice `paymentStatus` values:

- `unpaid`
- `paid`
- `partially`

Invoice `status` values:

- `draft`
- `pending`
- `sent`
- `refunded`
- `cancelled`
- `on hold`

### Payment

Source: [`backend/src/models/appModels/Payment.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/Payment.js)

- `createdBy`
- `number`
- `client`
- `invoice`
- `date`
- `amount`
- `currency`
- `ref`
- `description`

### Payment Mode

Source: [`backend/src/models/appModels/PaymentMode.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/PaymentMode.js)

- `name`
- `description`
- `isDefault`
- `enabled`

### Taxes

Source: [`backend/src/models/appModels/Taxes.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/models/appModels/Taxes.js)

- `taxName`
- `taxValue`
- `isDefault`
- `enabled`

## File and Download Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/download/:directory/:file` | No route-level auth in `app.js` | Generate and download PDF for a model-backed record |
| `GET` | `/public/:subPath/:directory/:file` | No route-level auth in `app.js` | Serve public asset from `backend/src/public` with path safety checks |

### Download Behavior

The download handler:

- derives model name from `:directory`
- extracts the record id from the requested filename
- generates a PDF if the record exists
- returns the generated file as a download

Source: [`backend/src/handlers/downloadHandler/downloadPdf.js`](/Users/finn/Desktop/ERP%20Website/idurar-erp-vercel/backend/src/handlers/downloadHandler/downloadPdf.js)

## Multipart Endpoints

These expect `multipart/form-data`.

| Method | Path | Field |
| --- | --- | --- |
| `PATCH` | `/api/admin/profile/update` | `photo` |
| `PATCH` | `/api/setting/upload/:settingKey?` | `settingValue` |

## Known Implementation Notes

- The route builder is highly pattern-based. Most ERP docs are best understood as a shared contract reused across entity names.
- Search defaults to the `name` field when no `fields` query param is supplied.
- Filter endpoints require both `filter` and `equal`.
- Login/logout use bearer tokens in the response/header flow rather than secure http-only cookies.
