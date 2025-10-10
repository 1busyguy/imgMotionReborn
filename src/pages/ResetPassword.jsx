import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Zap, Lock, Check, AlertCircle, Mail } from 'lucide-react';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [validToken, setValidToken] = useState(false);
    const [checkingToken, setCheckingToken] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Check if we have a valid recovery token from the email link
        const checkRecoveryToken = async () => {
            try {
                // Get the hash from URL (Supabase puts the token in the hash)
                const hashParams = new URLSearchParams(location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const type = hashParams.get('type');

                if (type === 'recovery' && accessToken) {
                    // Verify the session
                    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
                    
                    if (error) {
                        setError('Invalid or expired reset link. Please request a new one.');
                        setValidToken(false);
                    } else if (user) {
                        setValidToken(true);
                    }
                } else {
                    setError('Invalid reset link. Please request a new password reset email.');
                    setValidToken(false);
                }
            } catch (err) {
                console.error('Error checking token:', err);
                setError('Something went wrong. Please try again.');
                setValidToken(false);
            } finally {
                setCheckingToken(false);
            }
        };

        checkRecoveryToken();
    }, [location]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            setSuccess(true);
            
            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            setError(error.message || 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Show loading while checking token
    if (checkingToken) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                                <Zap className="w-8 h-8 text-white animate-pulse" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Verifying Reset Link...</h1>
                        <p className="text-purple-200">Please wait</p>
                    </div>
                </div>
            </div>
        );
    }

    // Show error if token is invalid
    if (!validToken) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">Invalid Reset Link</h1>
                        <p className="text-purple-200 mb-6">{error}</p>

                        <button
                            onClick={() => navigate('/forgot-password')}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 mx-auto"
                        >
                            <Mail className="w-5 h-5" />
                            <span>Request New Reset Link</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Show success message
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="flex justify-center mb-6">
                            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center">
                                <Check className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-3xl font-bold text-white mb-4">Password Updated!</h1>
                        <p className="text-purple-200 mb-6">
                            Your password has been successfully updated. Redirecting to login...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Show password reset form (only if valid token exists)
    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                            <Zap className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-white mb-2">Set New Password</h1>
                    <p className="text-purple-200">Enter your new password below</p>
                </div>

                {error && (
                    <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6 flex items-start space-x-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
                            New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength="6"
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Enter new password (min. 6 characters)"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-2">
                            Confirm New Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="password"
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="Confirm new password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Updating Password...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;