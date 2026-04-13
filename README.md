# IDURAR ERP CRM - Vercel + MongoDB Atlas Deployment

This is a modified version of [IDURAR ERP CRM](https://github.com/idurar/idurar-erp-crm) configured for deployment on Vercel with MongoDB Atlas.

## Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/idurar-erp-crm)

## Prerequisites

1. **MongoDB Atlas Account** (Free Tier)
   - Create at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Create a free cluster
   - Get connection string from Connect > Connect your application

2. **Vercel Account**
   - Create at [vercel.com](https://vercel.com)

## Step-by-Step Deployment

### 1. MongoDB Atlas Setup

1. Create a free cluster at MongoDB Atlas
2. Create a database user (Security > Database Access)
3. Whitelist all IPs (Security > Network Access > Allow Access from Anywhere)
4. Get connection string: Connect > Connect your application > Node.js
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `idurar`

### 2. Deploy to Vercel

1. Fork this repository
2. Import to Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your forked repository
   - Framework Preset: **Vite**

3. Add Environment Variables in Vercel:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE` | MongoDB connection string | ✅ Yes |
| `JWT_SECRET` | Random 32+ char string | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `OPENAI_API_KEY` | Your OpenAI key | ❌ Optional |
| `FRONTEND_URL` | Your Vercel URL | ❌ Optional |

### 3. Initialize Database

After first deployment, run the setup:

**Option A:** Via Vercel CLI
```bash
vercel env pull .env.local
npm run setup
```

**Option B:** Via MongoDB Atlas Shell
1. Go to MongoDB Atlas > Collections
2. Create collections manually following the schema

### 4. Create Admin User

The setup script creates a default admin:
- Email: `admin@demo.com`
- Password: `admin123`

⚠️ **Change this password immediately after first login!**

## Environment Variables

```env
# Required
DATABASE=mongodb+srv://user:pass@cluster.mongodb.net/idurar?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-key-at-least-32-characters
NODE_ENV=production

# Optional - Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional - AI Features
OPENAI_API_KEY=sk-...

# Optional - File Storage (S3)
FILE_STORAGE=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
```

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB connection string

# Run setup (first time only)
npm run setup

# Start development servers
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8888

## Project Structure

```
├── api/
│   └── index.js          # Vercel serverless entry point
├── backend/
│   ├── src/
│   │   ├── app.js        # Express app
│   │   ├── server.js     # Local development server
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # Mongoose models
│   │   ├── routes/       # API routes
│   │   └── ...
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── modules/      # Feature modules
│   │   ├── config/       # API configuration
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
├── vercel.json           # Vercel routing config
├── package.json          # Root package.json
└── README.md
```

## Troubleshooting

### MongoDB Connection Errors
- Verify connection string format
- Ensure IP whitelist includes `0.0.0.0/0` (all IPs)
- Check database user credentials

### 500 Internal Server Error
- Check Vercel logs for details
- Verify all required env vars are set
- Ensure DATABASE URL is correct

### Build Errors
- Node.js version must be 20.x
- Clear Vercel cache and rebuild

## License

This project uses the Fair-code License. See [LICENSE](LICENSE) for details.

## Credits

Original project: [IDURAR ERP CRM](https://github.com/idurar/idurar-erp-crm)
