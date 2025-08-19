# imgMotionMagic.com

> Transform your creative vision into reality with cutting-edge AI tools

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-2.51.0-green.svg)](https://supabase.com/)

## 🚀 Overview

imgMotionMagic is a comprehensive AI-powered content creation platform that democratizes access to cutting-edge AI models for image and video generation. Built with React, TypeScript, and Supabase, it provides an intuitive interface for creators to generate professional-quality visual content.

### ✨ Key Features

- **20+ AI Tools** - Access to the latest AI models including FLUX, Kling, VEO, WAN, and more
- **Multi-Modal Generation** - Create images, videos, and audio content
- **Professional Quality** - Generate content suitable for commercial use
- **Token-Based Pricing** - Fair, transparent pricing that scales with usage
- **Real-Time Updates** - Live progress tracking for all generations
- **User Gallery** - Organize and manage all your creations
- **Community Showcase** - Discover and share amazing AI-generated content
- **Subscription Management** - Flexible plans with Stripe integration

## 🛠️ Tech Stack

### Frontend
- **React 18.3.1** - Modern React with hooks and functional components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing

### Backend & Services
- **Supabase** - Backend-as-a-Service with PostgreSQL
- **Supabase Edge Functions** - Serverless functions for AI integrations
- **Stripe** - Payment processing and subscription management
- **FAL.ai** - AI model provider for image/video generation
- **Railway** - Additional AI model hosting

### AI Models Integrated
- **FLUX** (Redux, Kontext, LoRA) - Advanced image generation
- **WAN Pro/v2.2** - Professional video generation
- **Kling Pro** - High-quality image-to-video
- **VEO2/VEO3** - State-of-the-art video creation
- **Minimax Hailuo** - Cinematic video generation
- **LTXV** - Advanced video customization
- **CassetteAI** - Music generation
- **MMAudio** - Audio synthesis
- **BRIA** - Background removal
- **HiDream** - Text-to-image generation

## 🏗️ Architecture

### Database Schema
- **profiles** - User accounts and subscription data
- **ai_generations** - Generation history and metadata
- **subscriptions** - Stripe subscription management
- **token_reset_schedule** - Automated token renewal
- **ffmpeg_processing_logs** - Video processing tracking

### Key Components
- **Real-time subscriptions** - Live updates via Supabase Realtime
- **Webhook system** - Async processing with FAL.ai and Railway
- **Content moderation** - Safety scanning and NSFW detection
- **File storage** - Supabase Storage with CDN optimization
- **Admin panel** - User management and content moderation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Stripe account (for payments)
- FAL.ai API key
- OpenAI API key (for image analysis)

### Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# CDN Configuration (optional)
VITE_CDN_URL=your_cdn_url

# Cloudinary (for WAN 2.2 model)
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
```

### Edge Function Environment Variables

Configure these in your Supabase project:

```env
# API Keys
FAL_API_KEY=your_fal_api_key
OPENAI_API_KEY=your_openai_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# External Services
RAILWAY_API_URL=your_railway_api_url
RAILWAY_API_KEY=your_railway_api_key
FFMPEG_SERVICE_URL=your_ffmpeg_service_url

# Feature Flags
ENABLE_FFMPEG_PROCESSING=true
USE_EDGE_FUNCTION_ENDPOINTS=true
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd imgmotionmagic
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   ```bash
   # Initialize Supabase (if not already done)
   npx supabase init
   
   # Link to your project
   npx supabase link --project-ref your-project-ref
   
   # Run migrations
   npx supabase db push
   ```

4. **Deploy Edge Functions**
   ```bash
   # Deploy all edge functions
   npx supabase functions deploy
   
   # Or deploy individually
   npx supabase functions deploy fal-flux-kontext
   npx supabase functions deploy fal-minimax-hailuo
   # ... etc
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── AIToolModal.jsx     # Tool interaction modal
│   ├── EmailVerificationBanner.jsx
│   ├── Footer.jsx          # Site footer
│   ├── Hero.jsx           # Landing page hero
│   ├── MaintenanceWrapper.jsx
│   ├── NSFWAlert.jsx      # Content safety alerts
│   ├── OptimizedImage.jsx # CDN-optimized images
│   ├── OptimizedVideo.jsx # CDN-optimized videos
│   ├── PresetLoraSelector.jsx
│   ├── SafetyWarningModal.jsx
│   ├── ThemedAlert.jsx    # Consistent alert system
│   ├── Tools.jsx          # Tool showcase
│   ├── UserShowcase.jsx   # Community content
│   └── ...
├── pages/               # Main application pages
│   ├── Dashboard.jsx       # User dashboard
│   ├── Gallery.jsx        # User content gallery
│   ├── Settings.jsx       # Account settings
│   ├── Admin.jsx          # Admin panel
│   ├── fal-tools/         # AI tool pages
│   │   ├── FluxKontext.jsx
│   │   ├── MinimaxHailuo.jsx
│   │   ├── KlingPro.jsx
│   │   └── ...
│   └── ...
├── hooks/               # Custom React hooks
│   ├── useAuth.js          # Authentication state
│   ├── useRealtimeActivity.js
│   └── useMaintenance.js
├── utils/               # Utility functions
│   ├── storageHelpers.js   # File upload/management
│   ├── errorHandlers.js    # Error processing
│   ├── safescan.js        # Content safety
│   ├── cdnHelpers.js      # CDN optimization
│   └── ...
├── data/                # Static data and configurations
│   ├── data.js            # Subscription tiers, packages
│   └── falTools.js        # AI tool definitions
└── lib/                 # External service clients
    ├── supabaseClient.js   # Supabase configuration
    ├── stripe.js          # Stripe client
    └── stripeHelpers.js   # Payment utilities

supabase/
├── functions/           # Edge Functions
│   ├── fal-flux-kontext/   # FLUX image generation
│   ├── fal-minimax-hailuo/ # Video generation
│   ├── fal-kling-pro/     # Professional video
│   ├── stripe-webhook/    # Payment processing
│   ├── admin-ban-user/    # User moderation
│   └── ...
└── migrations/          # Database schema
```

## 🔧 Key Features Deep Dive

### AI Tool Integration
- **Async Processing** - All AI generations use webhook-based completion
- **Real-time Updates** - Live status updates via Supabase Realtime
- **Error Handling** - Comprehensive error detection and user feedback
- **Content Safety** - Multi-layer safety scanning and moderation

### User Management
- **Authentication** - Email/password and OAuth (Google)
- **Subscription Tiers** - Free, Pro, Business with different token allocations
- **Token System** - Flexible credit system for AI generations
- **Admin Panel** - User moderation and content management

### Content Processing
- **File Storage** - Supabase Storage with CDN optimization
- **Watermarking** - Automatic watermarks for free tier users
- **Thumbnail Generation** - Video thumbnails via FFmpeg
- **Content Moderation** - AI-powered safety scanning

## 🔐 Security Features

- **Content Safety Scanning** - Pre-generation safety analysis
- **NSFW Detection** - Image and prompt analysis
- **User Banning System** - Admin moderation tools
- **IP Tracking** - Signup and login IP logging
- **Rate Limiting** - Built-in protection against abuse

## 💳 Payment Integration

### Subscription Plans
- **Free Trial** - 200 tokens to start
- **Pro Plan** - $25.99/month, 3000 tokens
- **Business Plan** - $49.99/month, 6000 tokens

### Token Packages
- One-time purchases from $5 (400 tokens) to $250 (27,000 tokens)
- Purchased tokens never expire
- Subscription tokens reset monthly

## 🔄 Real-time Features

- **Live Generation Updates** - See progress in real-time
- **Activity Feed** - Recent generations and status
- **Community Showcase** - Live updates of featured content
- **Admin Monitoring** - Real-time user activity tracking

## 🛡️ Content Moderation

### Safety Pipeline
1. **Pre-generation Analysis** - Scan prompts and images
2. **AI Model Filtering** - Built-in safety checkers
3. **Post-generation Review** - Admin content moderation
4. **Community Reporting** - User-driven content flagging

### Admin Tools
- User management and banning
- Content showcase management
- Generation monitoring
- LoRA model management

## 📊 Analytics & Monitoring

- **User Activity Tracking** - Generation history and usage patterns
- **Token Usage Analytics** - Detailed consumption tracking
- **Error Monitoring** - Comprehensive error logging
- **Performance Metrics** - Real-time processing statistics

## 🚀 Deployment

### Vercel Deployment
```bash
# Build the project
npm run build

# Deploy to Vercel
vercel --prod
```

### Supabase Edge Functions
```bash
# Deploy all functions
npx supabase functions deploy

# Deploy specific function
npx supabase functions deploy fal-flux-kontext
```

### Environment Setup
1. Configure all environment variables in Vercel
2. Set up Stripe webhooks pointing to your domain
3. Configure FAL.ai webhooks for async processing
4. Set up CDN (optional) for optimized content delivery

## 🔧 Configuration

### Maintenance Mode
Toggle maintenance mode in `src/config/maintenance.js`:
```javascript
export const maintenanceConfig = {
  enabled: false, // Set to true to enable maintenance mode
  // ... other config
};
```

### Feature Flags
- `ENABLE_FFMPEG_PROCESSING` - Enable video processing
- `USE_EDGE_FUNCTION_ENDPOINTS` - Use shorter endpoint URLs
- Content safety sensitivity levels

## 📈 Scaling Considerations

- **Database Indexing** - Optimized queries for user generations
- **CDN Integration** - Fast content delivery worldwide
- **Edge Function Optimization** - Efficient serverless processing
- **Storage Management** - Automatic cleanup and optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Email**: imgmotionapp@gmail.com
- **Phone**: (802) 585-1294
- **Discord**: [Join our community](https://discord.gg/uXvbk5ETmP)

## 🙏 Acknowledgments

- [FAL.ai](https://fal.ai) - AI model infrastructure
- [Supabase](https://supabase.com) - Backend and database
- [Stripe](https://stripe.com) - Payment processing
- [Vercel](https://vercel.com) - Hosting and deployment

---

**Built with ❤️ by the imgMotionMagic team**

*Democratizing AI-powered creativity for everyone*