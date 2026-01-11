# imgMotion AI Tool Website

An AI-powered creative content generation platform built with React, TypeScript, and Supabase. Generate images, videos, music, and more using state-of-the-art AI models.

## Features

- **Text-to-Image Generation** - Create stunning images from text descriptions using multiple AI models (Flux, SeeDream, Qwen, and more)
- **Image Editing** - Edit and transform existing images with AI
- **Video Generation** - Generate videos from text or images
- **Music Generation** - Create AI-generated music and audio
- **Image Analysis** - Analyze images with AI vision models
- **User Authentication** - Secure authentication via Supabase
- **Subscription & Token System** - Flexible billing with subscriptions and token packages via Stripe

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions/Deno)
- **Video Processing Microservice**: Python/FastAPI on Railway (FFmpeg)
- **AI Services**: FAL.ai
- **Payments**: Stripe
- **Security**: Cloudflare Turnstile (CAPTCHA)
- **Deployment**: Vercel (frontend) + Railway (video processing)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Vercel         │────▶│  Supabase       │────▶│  FAL.ai         │
│  (React App)    │     │  (Edge Funcs)   │     │  (AI Models)    │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ Video Post-Processing
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Railway        │
                        │  (FFmpeg API)   │
                        │                 │
                        └─────────────────┘
```

The platform uses a microservice architecture:
- **Vercel** hosts the React frontend
- **Supabase Edge Functions** handle AI operations via FAL.ai
- **Railway** runs a Python/FastAPI microservice for video post-processing (thumbnails, watermarks, resizing)
- Webhooks notify Supabase when video processing completes

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A [Vercel](https://vercel.com) account (for frontend deployment)
- A [Supabase](https://supabase.com) account and project
- A [Google Cloud Console](https://console.cloud.google.com) project (for OAuth login)
- A [FAL.ai](https://fal.ai) account and API key
- A [Stripe](https://stripe.com) account (for payments)
- A [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) site key (for CAPTCHA)
- A [Railway](https://railway.app) account (for video processing microservice - optional)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/1busyguy/imgMotionReborn.git
   cd imgMotionReborn
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   See [Environment Variables](#environment-variables) for details.

4. **Set up Supabase**

   ```bash
   # Install Supabase CLI
   npm install -g supabase

   # Login to Supabase
   supabase login

   # Link to your project
   supabase link --project-ref your-project-ref

   # Run database migrations (creates tables, RLS policies, functions)
   supabase db push

   # Deploy Edge Functions
   supabase functions deploy

   # Set required secrets
   supabase secrets set FAL_API_KEY=your_fal_api_key
   supabase secrets set STRIPE_SECRET_KEY=your_stripe_secret_key
   supabase secrets set STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
   supabase secrets set OPENAI_API_KEY=your_openai_api_key
   ```

   See [Database Schema](#database-schema) for details on the database structure.

5. **Create Storage Bucket**

   In your Supabase Dashboard:
   - Go to Storage → Create new bucket
   - Name it `user-files`
   - Set appropriate policies (see migration file for examples)

6. **Set up Google OAuth**

   The app uses Google for authentication. Configure OAuth in Google Cloud Console:

   1. Go to [Google Cloud Console](https://console.cloud.google.com)
   2. Create a new project (or select existing)
   3. Navigate to **APIs & Services → Credentials**
   4. Click **Create Credentials → OAuth client ID**
   5. Select **Web application**
   6. Add authorized redirect URIs:
      - `https://your-project.supabase.co/auth/v1/callback` (production)
      - `http://localhost:5173/auth/callback` (development)
   7. Copy the **Client ID** and **Client Secret**

   Then configure in Supabase:
   1. Go to Supabase Dashboard → **Authentication → Providers**
   2. Enable **Google**
   3. Paste your Client ID and Client Secret
   4. Save

7. **Start the development server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Cloudflare Turnstile
VITE_TURNSTILE_SITE_KEY=your_turnstile_site_key

# CDN URL (optional)
VITE_CDN_URL=your_cdn_url
```

### Supabase Edge Function Secrets

The following secrets need to be configured in your Supabase project:

- `FAL_API_KEY` - Your FAL.ai API key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `OPENAI_API_KEY` - OpenAI API key (for image analysis)
- `FFMPEG_SERVICE_URL` - Your Railway FFmpeg service URL (e.g., `https://your-ffmpeg-service.up.railway.app`)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Project Structure

```
imgMotionReborn/
├── src/
│   ├── components/     # React components
│   ├── config/         # Configuration files
│   ├── contexts/       # React contexts
│   ├── data/           # Static data and constants
│   ├── hooks/          # Custom React hooks
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── types/          # TypeScript types
│   └── utils/          # Utility functions
├── supabase/
│   ├── functions/      # Edge Functions (53 functions)
│   └── migrations/     # Database migrations
├── ffmpeg-service/     # Railway microservice (Python/FastAPI)
│   ├── main.py         # FastAPI application
│   ├── utils/          # FFmpeg, storage, webhook utilities
│   ├── models/         # Pydantic schemas
│   └── Dockerfile      # Railway deployment
├── public/             # Static assets
└── ...
```

## Database Schema

The platform uses PostgreSQL via Supabase with the following tables:

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, token balance, subscription status |
| `ai_generations` | All AI generation records with status and outputs |
| `subscriptions` | Stripe subscription tracking |
| `preset_loras` | Admin-managed LoRA model presets |
| `ip_signup_tracking` | Abuse prevention (limits free accounts per IP) |

### Key Relationships

```
profiles (id) ← ai_generations (user_id)
profiles (id) ← subscriptions (user_id)
```

### Row Level Security (RLS)

All tables have RLS enabled with policies ensuring:
- Users can only access their own data
- Service role has full access for backend operations
- Public read access for showcased content
- IP tracking is service-role only (security)

### Database Functions

| Function | Purpose |
|----------|---------|
| `check_ip_signup_limit(ip)` | Check if IP can create free accounts |
| `increment_ip_signup_count(ip)` | Track successful signups |
| `admin_block_ip(ip, reason, admin_id)` | Manual IP blocking |
| `increment_showcase_views(id)` | Track public gallery views |

See `supabase/migrations/00000000000000_initial_schema.sql` for the complete schema definition.

## Supabase Edge Functions

The platform includes 53 Edge Functions for various AI operations:

- **Image Generation**: Flux, SeeDream, Qwen, Ideogram, Recraft, and more
- **Video Generation**: WAN, Hunyuan, Veo, Kling
- **Audio/Music**: MMAudio, audio generation
- **Image Processing**: Upscaling, background removal, face swap
- **Admin Operations**: User management, content moderation

## Deployment

### Vercel (Frontend)

1. Connect your GitHub repository to Vercel
2. Configure the environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_STRIPE_PUBLISHABLE_KEY`
   - `VITE_TURNSTILE_SITE_KEY`
   - `VITE_CDN_URL` (optional)
3. Deploy

The included `vercel.json` configures:
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy)
- SPA routing (all routes rewrite to index.html)

### Supabase (Backend)

Deploy Edge Functions using the Supabase CLI:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy

# Set secrets
supabase secrets set FAL_API_KEY=your_key
supabase secrets set STRIPE_SECRET_KEY=your_key
# ... etc
```

### Railway (FFmpeg Video Processing)

The `ffmpeg-service/` directory contains a Python/FastAPI microservice for video post-processing. This handles:

- **Thumbnail extraction** from videos
- **Watermark addition** to videos
- **Video resizing/compression**
- **Metadata extraction**

**Deployment:**

```bash
cd ffmpeg-service

# Option 1: Railway CLI
railway login
railway init
railway up

# Option 2: Connect GitHub repo to Railway
# Railway will auto-detect the Dockerfile
```

**Required environment variables** (set in Railway dashboard):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**API Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/extract-thumbnail` | Extract frame from video |
| `POST /api/v1/add-watermark` | Add watermark to video |
| `POST /api/v1/resize-video` | Resize/compress video |
| `POST /api/v1/get-metadata` | Get video metadata |

See `ffmpeg-service/README.md` for full documentation.

## Configuration

### Stripe Products

You'll need to create your own Stripe products and update the price IDs in `src/data/data.js`:

- Subscription tiers (Free, Basic, Standard, Pro, Ultra)
- Token packages (various amounts)

### Maintenance Mode

Toggle maintenance mode in `src/config/maintenance.js`:

```javascript
export const maintenanceConfig = {
  enabled: false, // Set to true to enable maintenance mode
  // ...
};
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FAL.ai](https://fal.ai) for AI model APIs
- [Supabase](https://supabase.com) for backend infrastructure
- [Stripe](https://stripe.com) for payment processing
- All the open source libraries that make this project possible
