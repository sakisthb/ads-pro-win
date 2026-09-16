# Ads Pro Digital

Performance marketing desk for paid ads, store till, and attribution.

Production hostname: [https://adpd.gr](https://adpd.gr) (Docker + Caddy). Local: `http://127.0.0.1:3000`.

A comprehensive marketing intelligence platform that leverages AI to optimize advertising campaigns across multiple platforms including Facebook, Google, TikTok, Instagram, and LinkedIn.

## ✨ Features

### 🎯 **Campaign Management**
- Multi-platform campaign creation and management
- Real-time performance tracking
- Budget optimization and spending analysis
- Target audience analysis and optimization

### 🤖 **AI-Powered Intelligence**
- Automated campaign optimization
- Creative generation and testing
- Performance prediction and forecasting
- Audience analysis and insights

### 📊 **Analytics & Reporting**
- Real-time performance metrics
- Cross-platform analytics
- Custom reporting dashboards
- ROI tracking and optimization

### 🔐 **Enterprise Security**
- Multi-tenant architecture
- Role-based access control
- Secure API integrations
- Data encryption and compliance

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Backend**: tRPC, Prisma ORM
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **AI Providers**: OpenAI, Anthropic, Google AI
- **Caching**: Redis
- **Deployment**: Docker + Caddy only (not Vercel)
- **UI**: Tailwind CSS, ShadCN UI

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/sakisthb/ads-pro-win.git
cd ads-pro-win

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_your-clerk-publishable-key"
CLERK_SECRET_KEY="sk_test_your-clerk-secret-key"

# AI Providers (Optional)
OPENAI_API_KEY="sk-your-openai-api-key"
ANTHROPIC_API_KEY="sk-ant-your-anthropic-api-key"
GOOGLE_API_KEY="your-google-api-key"

# Redis (Optional - for caching)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""
REDIS_DB="0"
```

## 📦 Deployment

**Vercel is retired. Do not use it.** Production is Docker + Caddy.

```bash
# From a host with .env created from .env.production.example
./deploy.sh
# Windows: .\deploy.ps1
```

Stack: `docker-compose.production.yml` (web, worker, redis, caddy). See `DEPLOYMENT_STRATEGY.md`.

## 🏗️ Project Structure

```
ads-pro-enterprise/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # React components
│   │   └── ui/             # ShadCN UI components
│   ├── lib/                # Utilities and configurations
│   │   ├── trpc/           # tRPC server setup
│   │   ├── cache.ts        # Redis caching
│   │   ├── auth.ts         # Authentication
│   │   └── db.ts           # Database connection
│   └── server/             # API routes
│       └── api/
│           └── routers/     # tRPC routers
├── prisma/                 # Database schema
├── public/                 # Static assets
└── docs/                   # Documentation
```

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run analyze      # Analyze bundle size
```

### Database Management

```bash
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema changes
npx prisma studio    # Open Prisma Studio
```

## 📊 Performance

- **Bundle Size**: 105 kB (First Load JS)
- **Build Time**: < 30 seconds
- **API Response**: < 200ms average
- **Caching**: Redis-based with 30min TTL

## 🔒 Security

- **Authentication**: Clerk with role-based access
- **API Security**: Rate limiting and CORS
- **Data Encryption**: End-to-end encryption
- **Compliance**: GDPR and SOC2 ready

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Site**: [https://adpd.gr](https://adpd.gr)
- **Issues**: [GitHub Issues](https://github.com/sakisthb/ads-pro-win/issues)

## 🎯 Roadmap

- [ ] Multi-language support
- [ ] Advanced AI models integration
- [ ] Mobile app development
- [ ] Enterprise SSO integration
- [ ] Advanced analytics dashboard
- [ ] API rate limiting improvements
- [ ] Real-time collaboration features

---

**Built with ❤️ by the Ads Pro Digital Team**
# Force deployment
