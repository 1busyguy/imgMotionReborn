import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedAdminRoute from './components/ProtectedAdminRoute';
import AdminLoraManager from './components/AdminLoraManager';
import { useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './hooks/useAuth';
import MaintenanceWrapper from './components/MaintenanceWrapper';
import BannedUserScreen from './components/BannedUserScreen';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
import FluxGenerator from './pages/FluxGenerator';
import FluxRedux from './pages/fal-tools/FluxRedux';
import FluxKontext from './pages/fal-tools/FluxKontext';
import MinimaxHailuo from './pages/fal-tools/MinimaxHailuo';
import WanPro from './pages/fal-tools/WanPro';
import Wan22 from './pages/fal-tools/Wan22';
import KlingPro from './pages/fal-tools/KlingPro';
import FluxKontextLora from './pages/fal-tools/FluxKontextLora';
import VEO2 from './pages/fal-tools/VEO2';
import LTXVVideo from './pages/fal-tools/LTXVVideo';
import FalVideoUpscaler from './pages/fal-tools/FalVideoUpscaler';
import BriaBackgroundRemover from './pages/fal-tools/BriaBackgroundRemover';
import VEO3Fast from './pages/fal-tools/VEO3Fast';
import AISceneGen from './pages/fal-tools/AISceneGen';
import HiDreamI1 from './pages/fal-tools/HiDreamI1';
import SeedancePro from './pages/fal-tools/SeedancePro';
import WanV22A14b from './pages/fal-tools/WanV22A14b';
import WanV22Text2VideoLora from './pages/fal-tools/WanV22Text2VideoLora';
import CassetteAIMusic from './pages/fal-tools/CassetteAIMusic';
import MMAudioV2 from './pages/fal-tools/MMAudioV2';
import MMAudioVideo2 from './pages/fal-tools/MMAudioVideo2';
import Omnihuman from './pages/fal-tools/Omnihuman';
import WanV22Img2VideoLora from './pages/fal-tools/WanV22Img2VideoLora';
import WanV22Video2Video from './pages/fal-tools/WanV22Video2Video';
import FluxKontextMaxMulti from './pages/fal-tools/FluxKontextMaxMulti';
import Admin from './pages/Admin';
import About from './pages/About';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import FAQ from './pages/FAQ';
import Careers from './pages/Careers';
import Pricing from './pages/Pricing';
import ImgMotionApp from './pages/ImgMotionApp';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = React.useState(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  // Check if user is banned
  React.useEffect(() => {
    if (user) {
      checkUserBanStatus();
    } else {
      setProfileLoading(false);
    }
  }, [user]);

  const checkUserBanStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('banned, ban_reason, banned_at')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking ban status:', error);
        // If we can't check ban status, allow access (fail open)
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in ban status check:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is banned
  if (profile?.banned) {
    return <BannedUserScreen 
      banReason={profile.ban_reason} 
      bannedAt={profile.banned_at} 
    />;
  }

  return children;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  // Let the Admin component handle its own auth checking
  // This prevents double auth checks and state conflicts
  return children;
};

function App() {
  useEffect(() => {
    // Handle email confirmation redirects
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        // User just confirmed their email
        console.log('Email confirmed successfully!');
        
        // Check if this is a Google OAuth sign-in and redirect to dashboard
        if (session?.user?.app_metadata?.provider === 'google') {
          console.log('Google OAuth sign-in detected, redirecting to dashboard...');
          window.location.href = '/dashboard';
        }
      }
      
      // Handle Google OAuth completion
      if (event === 'SIGNED_IN' && session?.user?.app_metadata?.provider === 'google') {
        console.log('Google OAuth completed, redirecting to dashboard...');
        // Small delay to ensure auth state is fully processed
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
    return () => subscription.unsubscribe();
  }, []);

  const handleSignUpClick = () => {
    // Use React Router navigation instead of window.location
    const signupUrl = '/signup';
    window.history.pushState({}, '', signupUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleSubscribeClick = (tier: any) => {
    // TODO: Implement Stripe subscription flow
    console.log('Subscribe to:', tier);
    // For now, redirect to signup if not logged in
    const signupUrl = '/signup';
    window.history.pushState({}, '', signupUrl);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <Router>
      <MaintenanceWrapper>
        <div className="App">
          <Routes>
            <Route 
              path="/" 
              element={
                <Landing 
                  onSignUpClick={handleSignUpClick}
                  onSubscribeClick={handleSubscribeClick}
                />
              } 
            />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/gallery" 
              element={
                <ProtectedRoute>
                  <Gallery />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-generator" 
              element={
                <ProtectedRoute>
                  <FluxGenerator />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-redux" 
              element={
                <ProtectedRoute>
                  <FluxRedux />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-kontext" 
              element={
                <ProtectedRoute>
                  <FluxKontext />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/minimax-hailuo" 
              element={
                <ProtectedRoute>
                  <MinimaxHailuo />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-pro" 
              element={
                <ProtectedRoute>
                  <WanPro />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan22-pro" 
              element={
                <ProtectedRoute>
                  <Wan22 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/kling-pro" 
              element={
                <ProtectedRoute>
                  <KlingPro />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-kontext-lora" 
              element={
                <ProtectedRoute>
                  <FluxKontextLora />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/veo2-video" 
              element={
                <ProtectedRoute>
                  <VEO2 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ltxv-video" 
              element={
                <ProtectedRoute>
                  <LTXVVideo />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/fal-video-upscaler" 
              element={
                <ProtectedRoute>
                  <FalVideoUpscaler />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bria-bg-remove" 
              element={
                <ProtectedRoute>
                  <BriaBackgroundRemover />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/veo3-fast" 
              element={
                <ProtectedRoute>
                  <VEO3Fast />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ai-scene-gen" 
              element={
                <ProtectedRoute>
                  <AISceneGen />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/hidream-i1" 
              element={
                <ProtectedRoute>
                  <HiDreamI1 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/seedance-pro" 
              element={
                <ProtectedRoute>
                  <SeedancePro />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-a14b" 
              element={
                <ProtectedRoute>
                  <WanV22A14b />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-text2video-lora" 
              element={
                <ProtectedRoute>
                  <WanV22Text2VideoLora />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/cassetteai-music" 
              element={
                <ProtectedRoute>
                  <CassetteAIMusic />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mmaudio-v2" 
              element={
                <ProtectedRoute>
                  <MMAudioV2 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mmaudio-video2" 
              element={
                <ProtectedRoute>
                  <MMAudioVideo2 />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/omnihuman" 
              element={
                <ProtectedRoute>
                  <Omnihuman />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-img2video-lora" 
              element={
                <ProtectedRoute>
                  <WanV22Img2VideoLora />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/wan-v22-video2video" 
              element={
                <ProtectedRoute>
                  <WanV22Video2Video />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/lora-manager" 
              element={
                <ProtectedRoute>
                  <AdminLoraManager />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/flux-kontext-max-multi" 
              element={
                <ProtectedRoute>
                  <FluxKontextMaxMulti />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/user/:userId" 
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              } 
            />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/imgmotionapp" element={<App />} />
            {/* Catch all route - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </MaintenanceWrapper>
    </Router>
  );
}

export default App;