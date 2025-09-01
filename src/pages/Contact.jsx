import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Mail, Phone, MapPin, MessageSquare, Send, Clock, Users, AlertCircle } from 'lucide-react';
import emailjs from '@emailjs/browser';

// Initialize EmailJS with your public key
// Replace 'YOUR_PUBLIC_KEY' with your actual EmailJS public key
emailjs.init('Qp-NYaynQrixPbaC2');

const Contact = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            // Send email using EmailJS
            // Replace 'YOUR_SERVICE_ID' and 'YOUR_TEMPLATE_ID' with your actual IDs from EmailJS
            const result = await emailjs.send(
                'service_imgmotionapp', // e.g., 'service_abc123'
                'template_xesa4q8', // e.g., 'template_xyz789'
                {
                    from_name: formData.name,
                    from_email: formData.email,
                    to_email: 'imgmotionapp@gmail.com',
                    subject: formData.subject,
                    message: formData.message,
                    reply_to: formData.email,
                }
            );

            if (result.status === 200) {
                setSubmitted(true);
                setFormData({ name: '', email: '', subject: '', message: '' });
            }
        } catch (error) {
            console.error('Failed to send email:', error);
            setError('Failed to send message. Please try again or contact us directly at imgmotionapp@gmail.com');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
            {/* Header */}
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
                                <h1 className="text-xl font-bold text-white">Contact Us</h1>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Hero Section */}
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
                        Get in Touch
                    </h1>
                    <p className="text-xl text-purple-200 max-w-3xl mx-auto">
                        Have questions, feedback, or need support? We'd love to hear from you.
                        Our team is here to help you make the most of imgMotion.
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-12">
                    {/* Contact Form */}
                    <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
                            <Send className="w-6 h-6 mr-3 text-purple-400" />
                            Send us a Message
                        </h2>

                        {submitted ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-2">Message Sent!</h3>
                                <p className="text-green-200">
                                    Thank you for reaching out. We'll get back to you within 24 hours.
                                </p>
                                <button
                                    onClick={() => {
                                        setSubmitted(false);
                                        setError('');
                                    }}
                                    className="mt-4 text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Error Alert */}
                                {error && (
                                    <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start space-x-3">
                                        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-red-200">{error}</div>
                                    </div>
                                )}

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-purple-200 mb-2">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                </div>

                                    <div>
                                        <label htmlFor="subject" className="block text-sm font-medium text-purple-200 mb-2">
                                            Subject *
                                        </label>
                                        <select
                                            id="subject"
                                            name="subject"
                                            value={formData.subject}
                                            onChange={handleChange}
                                            required
                                            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent [&>option]:bg-purple-900 [&>option]:text-white"
                                            style={{
                                                colorScheme: 'dark'
                                            }}
                                        >
                                            <option value="" className="bg-purple-900">Select a subject</option>
                                            <option value="general" className="bg-purple-900">General Inquiry</option>
                                            <option value="support" className="bg-purple-900">Technical Support</option>
                                            <option value="billing" className="bg-purple-900">Billing Question</option>
                                            <option value="feature" className="bg-purple-900">Feature Request</option>
                                            <option value="partnership" className="bg-purple-900">Partnership</option>
                                            <option value="press" className="bg-purple-900">Press Inquiry</option>
                                        </select>
                                    </div>

                                <div>
                                    <label htmlFor="message" className="block text-sm font-medium text-purple-200 mb-2">
                                        Message *
                                    </label>
                                    <textarea
                                        id="message"
                                        name="message"
                                        value={formData.message}
                                        onChange={handleChange}
                                        required
                                        rows={6}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                        placeholder="Tell us how we can help you..."
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
                                            <span>Send Message</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-8">
                        {/* Contact Details */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-6">Contact Information</h3>
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Email</p>
                                        <a href="mailto:imgmotionapp@gmail.com" className="text-purple-300 hover:text-purple-200 transition-colors">
                                            imgmotionapp@gmail.com
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                                        <Phone className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Phone</p>
                                        <a href="tel:+18025851294" className="text-purple-300 hover:text-purple-200 transition-colors">
                                            (802) 585-1294
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                                        <MapPin className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">Location</p>
                                        <p className="text-purple-300">Philadelphia, PA</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Response Time */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Clock className="w-5 h-5 mr-2 text-yellow-400" />
                                Response Times
                            </h3>
                            <div className="space-y-3 text-purple-200">
                                <div className="flex justify-between">
                                    <span>General Inquiries:</span>
                                    <span className="text-white">24-72 hours</span>
                                </div>
                            </div>
                        </div>

                        {/* Support Hours */}
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                                <Users className="w-5 h-5 mr-2 text-green-400" />
                                Support Hours
                            </h3>
                            <div className="space-y-2 text-purple-200">
                                <p><strong className="text-white">Monday - Friday:</strong> 9:00 AM - 6:00 PM EST</p>
                                <p><strong className="text-white">Saturday:</strong> 10:00 AM - 4:00 PM EST</p>
                                <p><strong className="text-white">Sunday:</strong> Closed</p>
                                <p className="text-sm text-purple-300 mt-3">
                                    * Emergency support available 24/7 for Enterprise customers
                                </p>
                            </div>
                        </div>

                        {/* FAQ Link */}
                        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-3">Quick Help</h3>
                            <p className="text-purple-200 mb-4">
                                Looking for immediate answers? Check out our FAQ section for common questions and solutions.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Link
                                    to="/faq"
                                    className="inline-flex items-center justify-center space-x-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    <Zap className="w-4 h-4" />
                                    <span>Visit FAQ</span>
                                </Link>
                                <Link
                                    to="https://discord.gg/uXvbk5ETmP"
                                    className="inline-flex items-center justify-center space-x-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                >
                                    <Zap className="w-4 h-4" />
                                    <span>Join Discord</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Contact;