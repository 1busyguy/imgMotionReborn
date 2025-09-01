// supabase/functions/verify-turnstile/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { token, email, fingerprint } = await req.json()

        // Get client IP and user agent
        const clientIP = req.headers.get('CF-Connecting-IP') ||
            req.headers.get('X-Forwarded-For')?.split(',')[0] ||
            req.headers.get('X-Real-IP') ||
            'unknown'

        const userAgent = req.headers.get('User-Agent') || 'unknown'

        // Check if IP is blocked
        const { data: blockedIP } = await supabase
            .from('blocked_ips')
            .select('*')
            .eq('ip_address', clientIP)
            .or('permanent.eq.true,blocked_until.gt.now()')
            .single()

        if (blockedIP) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Access denied. Your IP has been blocked due to suspicious activity.'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 403
                }
            )
        }

        // Check rate limiting (5 attempts per hour by default)
        const { data: rateCheck } = await supabase
            .rpc('check_rate_limit', {
                p_ip_address: clientIP,
                p_limit: 5,
                p_window_minutes: 60
            })

        if (!rateCheck) {
            // Log the rate limit violation
            await supabase
                .from('signup_attempts')
                .insert({
                    ip_address: clientIP,
                    email: email,
                    attempt_type: 'signup',
                    success: false,
                    turnstile_verified: false,
                    user_agent: userAgent,
                    fingerprint: fingerprint
                })

            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Too many signup attempts. Please try again later.'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429
                }
            )
        }

        // Check if email domain is blocked
        const { data: emailBlocked } = await supabase
            .rpc('is_email_blocked', { p_email: email })

        if (emailBlocked) {
            // Log the blocked email attempt
            await supabase
                .from('signup_attempts')
                .insert({
                    ip_address: clientIP,
                    email: email,
                    attempt_type: 'signup',
                    success: false,
                    turnstile_verified: false,
                    email_risk: 'high',
                    user_agent: userAgent,
                    fingerprint: fingerprint
                })

            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'This email domain is not allowed. Please use a different email address.',
                    emailRisk: 'high'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                }
            )
        }

        // Verify Turnstile token
        const formData = new FormData()
        formData.append('secret', TURNSTILE_SECRET_KEY!)
        formData.append('response', token)
        formData.append('remoteip', clientIP)

        const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        })

        const turnstileResult = await turnstileResponse.json()

        if (!turnstileResult.success) {
            // Log failed CAPTCHA
            await supabase
                .from('signup_attempts')
                .insert({
                    ip_address: clientIP,
                    email: email,
                    attempt_type: 'signup',
                    success: false,
                    turnstile_verified: false,
                    user_agent: userAgent,
                    fingerprint: fingerprint
                })

            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'CAPTCHA verification failed',
                    codes: turnstileResult['error-codes']
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400
                }
            )
        }

        // Analyze email for risk assessment
        let emailRisk = 'low'
        const emailLower = email.toLowerCase()
        const emailLocal = emailLower.split('@')[0]
        const emailDomain = emailLower.split('@')[1]

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /^[a-z0-9]{20,}$/, // Very long random strings
            /^test\d+$/, // test123
            /^user\d+$/, // user456
            /^temp/, // temp*
            /^throwaway/, // throwaway*
            /^fake/, // fake*
        ]

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(emailLocal)) {
                emailRisk = 'medium'
                break
            }
        }

        // Check for excessive numbers
        const numbersInEmail = (emailLocal.match(/\d/g) || []).length
        if (numbersInEmail > 5) {
            emailRisk = 'high'
        }

        // Check for multiple + signs (alias abuse)
        if (emailLocal.includes('+') && emailLocal.split('+').length > 2) {
            emailRisk = 'high'
        }

        // Check if same fingerprint has created multiple accounts recently
        if (fingerprint) {
            const { count: fingerprintCount } = await supabase
                .from('signup_attempts')
                .select('*', { count: 'exact', head: true })
                .eq('fingerprint', fingerprint)
                .eq('success', true)
                .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

            if (fingerprintCount && fingerprintCount > 2) {
                emailRisk = 'high'
            }
        }

        // Log successful verification
        await supabase
            .from('signup_attempts')
            .insert({
                ip_address: clientIP,
                email: email,
                attempt_type: 'signup',
                success: true,
                turnstile_verified: true,
                email_risk: emailRisk,
                user_agent: userAgent,
                fingerprint: fingerprint
            })

        return new Response(
            JSON.stringify({
                success: true,
                ip: clientIP,
                emailRisk,
                hostname: turnstileResult.hostname,
                timestamp: new Date().toISOString()
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error) {
        console.error('Error in verify-turnstile:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})