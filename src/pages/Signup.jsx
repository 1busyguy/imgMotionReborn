import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Zap, Mail, Lock, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import TurnstileWidget from '../components/TurnstileWidget';
import {
    isDisposableEmail,
    assessEmailRisk,
    isValidEmailFormat,
    getEmailValidationMessage
} from '../utils/emailValidation';
import {
    getDeviceFingerprint,
    checkDeviceRateLimit,
    getDeviceInfo
} from '../utils/deviceFingerprint';

const Signup = () => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [turnstileToken, setTurnstileToken] = useState('');
    const [emailWarning, setEmailWarning] = useState('');
    const [deviceFingerprint, setDeviceFingerprint] = useState('');
    const [rateLimitWarning, setRateLimitWarning] = useState('');

    // Get device fingerprint on component mount
    useEffect(() => {
        const loadFingerprint = async () => {
            try {
                const fp = await getDeviceFingerprint();
                setDeviceFingerprint(fp);

                // Check rate limit for this device
                const { allowed, remainingAttempts } = checkDeviceRateLimit(fp, 'signup', 3, 60);
                if (!allowed) {
                    setRateLimitWarning('Too many signup attempts from this device. Please try again later.');
                } else if (remainingAttempts <= 1) {
                    setRateLimitWarning(`You have ${remainingAttempts} signup attempt${remainingAttempts === 1 ? '' : 's'} remaining.`);
                }
            } catch (error) {
                console.error('Error loading fingerprint:', error);
            }
        };
        loadFingerprint();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });

        // Real-time email validation
        if (name === 'email') {
            validateEmailRealtime(value);
        }
    };

    const validateEmailRealtime = (email) => {
        if (!email) {
            setEmailWarning('');
            return;
        }

        // Check email format first
        if (!isValidEmailFormat(email)) {
            setEmailWarning('Please enter a valid email address');
            return;
        }

        // Check if it's disposable
        if (isDisposableEmail(email)) {
            setEmailWarning('Disposable email addresses are not allowed. Please use a permanent email address.');
            return;
        }

        // Assess risk level
        const riskLevel = assessEmailRisk(email);
        const message = getEmailValidationMessage(email, riskLevel);
        setEmailWarning(message);
    };

    const handleTurnstileVerify = (token) => {
        setTurnstileToken(token);
        setError('');
    };

    const handleTurnstileError = () => {
        setError('CAPTCHA verification failed. Please try again.');
        setTurnstileToken('');
    };

    const handleTurnstileExpire = () => {
        setTurnstileToken('');
        setError('CAPTCHA expired. Please complete it again.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Check rate limit
        if (rateLimitWarning && rateLimitWarning.includes('Too many')) {
            setError(rateLimitWarning);
            return;
        }

        // Check for CAPTCHA token
        if (!turnstileToken) {
            setError('Please complete the CAPTCHA verification');
            return;
        }

        // Validate email
        if (!isValidEmailFormat(formData.email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (isDisposableEmail(formData.email)) {
            setError('Disposable email addresses are not allowed. Please use a permanent email address.');
            return;
        }

        const emailRisk = assessEmailRisk(formData.email);
        if (emailRisk === 'high') {
            setError('This email address appears to be invalid or high-risk. Please use a different email.');
            return;
        }

        // Validate passwords
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        // Check password strength (optional)
        if (formData.password.length < 8) {
            setError('For better security, please use a password with at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            // Get device info for additional validation
            const deviceInfo = getDeviceInfo();

            // Verify the Turnstile token with your backend
            const verifyResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-turnstile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: turnstileToken,
                    email: formData.email,
                    fingerprint: deviceFingerprint,
                    deviceInfo: {
                        userAgent: deviceInfo.userAgent,
                        platform: deviceInfo.platform,
                        screenResolution: `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}`,
                        timezone: deviceInfo.timezone
                    }
                })
            });

            const verifyResult = await verifyResponse.json();

            if (!verifyResult.success) {
                throw new Error(verifyResult.error || 'CAPTCHA verification failed. Please try again.');
            }

            // Check if backend detected high risk
            if (verifyResult.emailRisk === 'high') {
                throw new Error('This email address appears to be invalid or high-risk. Please use a different email.');
            }

            // Proceed with signup
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    emailRedirectTo: `https://imgmotion.com/dashboard`,
                    data: {
                        turnstile_verified: true,
                        signup_ip: verifyResult.ip,
                        device_fingerprint: deviceFingerprint,
                        email_risk: verifyResult.emailRisk
                    }
                }
            });

            if (error) throw error;

            if (data.user) {
                if (data.user.email_confirmed_at) {
                    setSuccess('Account created successfully! You can now sign in.');
                } else {
                    setSuccess('Account created! Please check your email and click the confirmation link to activate your account.');
                }

                // Clear form
                setFormData({ email: '', password: '', confirmPassword: '' });
                setTurnstileToken('');
                setEmailWarning('');
            }
        } catch (error) {
            if (error.message.includes('Database error saving new user')) {
                setError('There was an issue setting up your account. Please try again or contact support.');
            } else if (error.message.includes('User already registered')) {
                setError('An account with this email already exists. Please sign in instead.');
            } else {
                setError(error.message || 'An error occurred during signup');
            }
            // Reset Turnstile on error
            setTurnstileToken('');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        try {
            // Store device fingerprint for OAuth signup
            if (deviceFingerprint) {
                sessionStorage.setItem('oauth_device_fingerprint', deviceFingerprint);
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`
                }
            });
            if (error) throw error;
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <Link to="/" className="inline-flex items-center space-x-2 text-purple-200 hover:text-white transition-colors mb-4">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Home</span>
                    </Link>

                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">Join imgMotion</h1>
                    <p className="text-purple-200">Create your account and start creating amazing content</p>
                </div>

                {/* Security notice */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-6 flex items-start space-x-2">
                    <Shield className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-purple-200">
                        Your account is protected with advanced security measures including CAPTCHA verification and fraud detection.
                    </div>
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 rounded-lg mb-6">
                        {success}
                    </div>
                )}

                {rateLimitWarning && !rateLimitWarning.includes('Too many') && (
                    <div className="bg-amber-500/20 border border-amber-500 text-amber-100 px-4 py-3 rounded-lg mb-6 text-sm">
                        {rateLimitWarning}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className={`w-full pl-10 pr-4 py-3 bg-white/10 border ${emailWarning ? 'border-amber-500' : 'border-white/20'
                                    } rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
                                placeholder="Enter your email"
                            />
                        </div>
                        {emailWarning && (
                            <div className="mt-2 flex items-start space-x-1">
                                <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <p className="text-amber-300 text-xs">{emailWarning}</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength="6"
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Create a password (min. 8 characters)"
                            />
                        </div>
                        <p className="text-purple-300 text-xs mt-1">Use at least 8 characters for better security</p>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-2">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Confirm your password"
                            />
                        </div>
                    </div>

                    {/* Turnstile CAPTCHA */}
                    <div className="bg-white/5 rounded-lg p-4">
                        <p className="text-purple-200 text-sm text-center mb-3">Please verify you're human</p>
                        <TurnstileWidget
                            onVerify={handleTurnstileVerify}
                            onError={handleTurnstileError}
                            onExpire={handleTurnstileExpire}
                            theme="dark"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !turnstileToken || !!emailWarning || rateLimitWarning.includes('Too many')}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/20" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-purple-200">Or continue with</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleSignUp}
                        disabled={rateLimitWarning.includes('Too many')}
                        className="mt-4 w-full bg-white hover:bg-gray-50 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-900 font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:transform-none flex items-center justify-center space-x-3 border border-gray-300"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Continue with Google</span>
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-purple-200">
                        Already have an account?{' '}
                        <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
                            Sign in
                        </Link>
                    </p>
                </div>

                <div className="mt-4 text-center">
                    <p className="text-purple-300 text-xs">
                        By signing up, you agree to our{' '}
                        <Link to="/terms" className="text-purple-400 hover:text-purple-300">Terms of Service</Link>
                        {' and '}
                        <Link to="/privacy" className="text-purple-400 hover:text-purple-300">Privacy Policy</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;