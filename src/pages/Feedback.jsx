import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Send, CheckCircle, AlertCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';

emailjs.init('Qp-NYaynQrixPbaC2');

const Feedback = () => {
    const form = useRef();
    const [formData, setFormData] = useState({
        user_name: '',
        user_email: '',
        liked_most: '',
        easy_to_use: '',
        needs_improvement: '',
        recommend_friend: '',
        additional_comments: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            const result = await emailjs.sendForm(
                'service_imgmotionapp',
                'template_feedback',
                form.current,
                'Qp-NYaynQrixPbaC2'
            );

            if (result.status === 200) {
                setSubmitted(true);
                setFormData({
                    user_name: '',
                    user_email: '',
                    liked_most: '',
                    easy_to_use: '',
                    needs_improvement: '',
                    recommend_friend: '',
                    additional_comments: ''
                });
            }
        } catch (error) {
            console.error('Failed to send feedback:', error);
            setError('Failed to send feedback. Please try again or contact us directly at imgmotionapp@gmail.com');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
            <header className="bg-white/10 backdrop-blur-md border-b border-white/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Link
                                to="/"
                                className="flex items-center space-x-2 text-purple-200 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span>Back to Home</span>
                            </Link>
                            <div className="h-6 w-px bg-white/20"></div>
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                                    <MessageSquare className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold text-white">User Feedback</h1>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                        We Value Your Feedback
                    </h1>
                    <p className="text-xl text-purple-200 max-w-3xl mx-auto">
                        Hello, from time to time we ask our users how they like our services. This helps us understand 
                        our users and create better tools and experiences for them. If you could take 2 minutes to fill 
                        out this quick survey that would be amazing. Thanks!
                    </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8">
                    {submitted ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-2">Thank You!</h3>
                            <p className="text-green-200 mb-6">
                                Your feedback has been submitted successfully. We appreciate you taking the time to help us improve!
                            </p>
                            <button
                                onClick={() => {
                                    setSubmitted(false);
                                    setError('');
                                }}
                                className="text-purple-400 hover:text-purple-300 transition-colors"
                            >
                                Submit another response
                            </button>
                        </div>
                    ) : (
                        <form ref={form} onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start space-x-3">
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-red-200">{error}</div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="user_name" className="block text-sm font-medium text-purple-200 mb-2">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="user_name"
                                        name="user_name"
                                        value={formData.user_name}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Your name"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="user_email" className="block text-sm font-medium text-purple-200 mb-2">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        id="user_email"
                                        name="user_email"
                                        value={formData.user_email}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="your@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="liked_most" className="block text-sm font-medium text-purple-200 mb-2">
                                    What did you like most about the imgMotion tools? *
                                </label>
                                <textarea
                                    id="liked_most"
                                    name="liked_most"
                                    value={formData.liked_most}
                                    onChange={handleChange}
                                    required
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    placeholder="Tell us what you enjoyed..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-3">
                                    Were the imgMotion tools easy to use? *
                                </label>
                                <div className="space-y-3">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="easy_to_use"
                                            value="yes"
                                            checked={formData.easy_to_use === 'yes'}
                                            onChange={handleChange}
                                            required
                                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 focus:ring-purple-500"
                                        />
                                        <span className="text-white">Yes, they were easy to use</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="easy_to_use"
                                            value="no"
                                            checked={formData.easy_to_use === 'no'}
                                            onChange={handleChange}
                                            required
                                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 focus:ring-purple-500"
                                        />
                                        <span className="text-white">No, they were difficult to use</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="needs_improvement" className="block text-sm font-medium text-purple-200 mb-2">
                                    What would you say needs improvement? *
                                </label>
                                <textarea
                                    id="needs_improvement"
                                    name="needs_improvement"
                                    value={formData.needs_improvement}
                                    onChange={handleChange}
                                    required
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    placeholder="Share your suggestions for improvement..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-purple-200 mb-3">
                                    Would you be likely to recommend a friend to use imgMotion? *
                                </label>
                                <div className="space-y-3">
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="recommend_friend"
                                            value="yes"
                                            checked={formData.recommend_friend === 'yes'}
                                            onChange={handleChange}
                                            required
                                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 focus:ring-purple-500"
                                        />
                                        <span className="text-white">Yes, I would recommend it</span>
                                    </label>
                                    <label className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="recommend_friend"
                                            value="no"
                                            checked={formData.recommend_friend === 'no'}
                                            onChange={handleChange}
                                            required
                                            className="w-4 h-4 text-purple-500 bg-white/10 border-white/20 focus:ring-purple-500"
                                        />
                                        <span className="text-white">No, I would not recommend it</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="additional_comments" className="block text-sm font-medium text-purple-200 mb-2">
                                    Any Additional Comments
                                </label>
                                <textarea
                                    id="additional_comments"
                                    name="additional_comments"
                                    value={formData.additional_comments}
                                    onChange={handleChange}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    placeholder="Anything else you'd like to share..."
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Submit Feedback</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-purple-300 text-sm">
                        Your feedback helps us improve imgMotion for everyone. Thank you for your time!
                    </p>
                </div>
            </main>
        </div>
    );
};

export default Feedback;