# AI Features Setup Guide
## Ads Pro Enterprise - AI-Powered Campaign Workspace

This guide explains how to set up and run the AI-powered features in Ads Pro Enterprise, including real-time WebSocket integration and comprehensive AI tools.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env.local` file in the project root with the following variables:

```env
# Database (Required)
DATABASE_URL="postgresql://username:password@localhost:5432/ads_pro_enterprise"

# AI Provider API Keys (At least one required)
OPENAI_API_KEY="sk-xxxxxxxx"
ANTHROPIC_API_KEY="sk-ant-xxxxxxxx"
GOOGLE_API_KEY="your-google-api-key"

# WebSocket Configuration
WS_PORT=3001
NEXT_PUBLIC_WS_URL="ws://localhost:3001"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Database Setup
```bash
# Push database schema
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### 4. Start Development Servers

#### Option A: Start Everything Together (Recommended)
```bash
npm run dev:ws
```
This starts both the Next.js app and the WebSocket server simultaneously.

#### Option B: Start Servers Separately
```bash
# Terminal 1: Start Next.js development server
npm run dev

# Terminal 2: Start WebSocket server
npm run ws:dev
```

## 🎯 AI Features Overview

### 1. Campaign Analysis
- **Real-time AI analysis** with progress tracking
- **Multiple AI providers** (OpenAI, Anthropic, Google)
- **Analysis types**: Comprehensive, Performance, Audience, Budget
- **Confidence scoring** and detailed insights
- **WebSocket integration** for live progress updates

### 2. Creative Generation
- **Platform-specific** creative content (Facebook, Instagram, Google Ads, TikTok, LinkedIn)
- **Multiple creative types** (Text, Image, Video, Carousel)
- **Audience targeting** and goal-based generation
- **Creative variants** with comparison tools
- **Copy-to-clipboard** functionality

### 3. Performance Optimization
- **AI-powered recommendations** with confidence scoring
- **Before/after metrics** projections
- **Implementation guides** for each recommendation
- **Performance score** visualization
- **Impact analysis** and ROI calculations

### 4. Real-Time Analytics Dashboard
- **Live metrics** with WebSocket updates
- **Multiple timeframes** (1d, 7d, 30d, 90d)
- **Auto-refresh** functionality (30-second intervals)
- **AI activity tracking** and history
- **Campaign performance** overview

### 5. WebSocket Status Monitoring
- **Real-time connection** status display
- **Detailed diagnostics** and connection info
- **Error handling** and automatic reconnection
- **AI operation tracking** with progress indicators

## 🔧 Development Commands

### Standard Development
```bash
npm run dev                 # Start Next.js only
npm run dev:ws             # Start Next.js + WebSocket server
npm run build              # Build for production
npm run start              # Start production server
npm run start:full         # Start production + WebSocket
```

### WebSocket Server
```bash
npm run ws:dev             # Start WebSocket server (development)
npm run ws:start           # Start WebSocket server (production)
```

### Database Management
```bash
npx prisma studio          # Open Prisma Studio
npx prisma db push         # Push schema changes
npx prisma db pull         # Pull schema from database
npx prisma generate        # Generate Prisma client
```

### Code Quality
```bash
npm run lint               # Run ESLint
npm run lint:fix           # Fix ESLint errors
npm run type-check         # TypeScript type checking
```

## 📱 Accessing AI Features

### Demo Page
Visit `http://localhost:3000/ai-demo` to see all AI features in action with demo data.

### Main Application
The AI workspace is integrated into the main application and can be accessed through:
- Campaign management interface
- Analytics dashboard
- Performance optimization tools

## 🔌 WebSocket Integration

### Connection Status
- **Green indicator**: Connected and ready
- **Yellow indicator**: Connecting or reconnecting
- **Red indicator**: Disconnected or error

### Real-Time Features
- **AI operation progress**: Live updates during analysis, generation, and optimization
- **Connection monitoring**: Automatic reconnection on network issues
- **Session management**: Persistent connections with unique session IDs
- **Error handling**: Graceful error recovery and user notifications

## 🛠️ Troubleshooting

### WebSocket Connection Issues
1. **Check server status**: Ensure WebSocket server is running on port 3001
2. **Verify environment**: Check `NEXT_PUBLIC_WS_URL` in your `.env.local`
3. **Firewall settings**: Make sure port 3001 is open
4. **Browser console**: Check for WebSocket connection errors

### AI Provider Errors
1. **API Keys**: Verify your AI provider API keys are valid
2. **Rate limits**: Check if you've exceeded API rate limits
3. **Network issues**: Ensure stable internet connection
4. **Provider status**: Check if the AI provider service is operational

### Database Connection Issues
1. **Connection string**: Verify your `DATABASE_URL` is correct
2. **Database running**: Ensure PostgreSQL is running
3. **Schema sync**: Run `npx prisma db push` to sync schema
4. **Permissions**: Check database user permissions

### Performance Issues
1. **Development mode**: Use production build for better performance
2. **WebSocket load**: Monitor WebSocket connection count
3. **Memory usage**: Check for memory leaks in long-running sessions
4. **AI operations**: Limit concurrent AI operations

## 📊 Component Architecture

### AI Components Structure
```
src/components/ai/
├── ai-analysis-panel.tsx          # Campaign analysis interface
├── creative-generation-panel.tsx  # Creative content generation
├── optimization-dashboard.tsx     # Performance optimization
├── realtime-analytics-dashboard.tsx # Live analytics dashboard
├── websocket-status.tsx          # Connection status monitoring
├── ai-workspace.tsx              # Integrated workspace
└── index.ts                      # Centralized exports
```

### Hooks Structure
```
src/hooks/
├── use-ai-agents.ts              # AI operations hooks
├── use-campaigns.ts              # Campaign management hooks
└── use-websocket.ts              # WebSocket connection hooks
```

### API Structure
```
src/lib/trpc/routers/
├── ai.ts                         # AI-related endpoints
├── campaigns.ts                  # Campaign management endpoints
└── root.ts                       # Router configuration
```

## 🔑 Environment Variables Guide

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`: At least one AI provider key

### Optional Variables
- `WS_PORT`: WebSocket server port (default: 3001)
- `GOOGLE_API_KEY`: Google AI provider key
- `MISTRAL_API_KEY`: Mistral AI provider key
- `PERPLEXITY_API_KEY`: Perplexity AI provider key

### Development Variables
- `NODE_ENV`: Set to "development" for development features
- `NEXT_PUBLIC_WS_URL`: WebSocket server URL for client connection

## 🚦 Production Deployment

### Build Process
```bash
npm run build
npm run start:full
```

### Environment Considerations
1. **WebSocket URL**: Update `NEXT_PUBLIC_WS_URL` for production domain
2. **Database**: Use production PostgreSQL instance
3. **API Keys**: Use production AI provider keys
4. **SSL/TLS**: Ensure HTTPS for production WebSocket connections (WSS)

### Monitoring
- WebSocket connection health
- AI provider API usage and costs
- Database performance and connections
- Application performance and errors

## 📝 Additional Resources

- **Prisma Documentation**: https://www.prisma.io/docs
- **tRPC Documentation**: https://trpc.io/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check WebSocket server logs
4. Verify environment variable configuration
5. Ensure all required services are running

---

**Note**: This setup guide covers the development environment. For production deployment, additional considerations for security, scaling, and monitoring should be implemented.