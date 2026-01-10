# imgMotion

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
- **Video Generation Microservice**: Python/FastAPI on Railway
- **AI Services**: FAL.ai
- **Payments**: Stripe
- **Security**: Cloudflare Turnstile (CAPTCHA)
- **Deployment**: Vercel (frontend) + Railway (video microservice)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Vercel         │────▶│  Supabase       │────▶│  FAL.ai         │
│  (React App)    │     │  (Edge Funcs)   │     │  (AI Models)    │
│                 │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 │ Video Generation
                                 ▼
                        ┌─────────────────┐
                        │                 │
                        │  Railway        │
                        │  (Python API)   │
                        │                 │
                        └─────────────────┘
```

The platform uses a microservice architecture:
- **Vercel** hosts the React frontend
- **Supabase Edge Functions** handle most AI operations via FAL.ai
- **Railway** runs a Python/FastAPI microservice for advanced video generation (WAN, Pixverse, LUMA, VEO3 models)
- Supabase receives webhooks from Railway when video processing completes

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- A [Supabase](https://supabase.com) account and project
- A [FAL.ai](https://fal.ai) account and API key
- A [Stripe](https://stripe.com) account (for payments)
- A [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) site key (for CAPTCHA)
- A [Railway](https://railway.app) account (for video generation microservice - optional)

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/imgMotionReborn.git
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

   - Create a new Supabase project
   - Run the migrations in `/supabase/migrations`
   - Deploy the Edge Functions from `/supabase/functions`

5. **Start the development server**

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
- `RAILWAY_API_URL` - Your Railway microservice URL (e.g., `https://your-app.up.railway.app`)
- `RAILWAY_API_KEY` - API key for Railway microservice authentication

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
├── public/             # Static assets
└── ...
```

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

### Railway (Video Microservice)

The video generation feature requires a separate Python microservice. This is **not included** in this repository.

To use video generation, you'll need to:

1. Create your own Python/FastAPI service that handles video generation
2. Deploy it to [Railway](https://railway.app) (or similar platform)
3. Configure the following endpoints:
   - `POST /api/v1/generate-scene` - Accepts video generation requests
4. Implement webhook callbacks to `https://your-supabase-project.supabase.co/functions/v1/railway-webhook`

**Supported video models** (via FAL.ai):
- WAN (Default & Pro)
- Pixverse v3.5
- LUMA Ray2
- VEO3 (Standard & Fast)

The Edge Function `supabase/functions/railway-webhook/index.ts` handles incoming webhooks from the Railway service when video processing completes.

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
