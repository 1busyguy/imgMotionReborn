import React from 'react';
import Hero from '../components/Hero';
import Tools from '../components/Tools';
import ToolShowcase from '../components/ToolShowcase';
import UserShowcase from '../components/UserShowcase';
import Testimonials from '../components/Testimonials';
import Subscription from '../components/Subscription';
import Footer from '../components/Footer';

const Landing = () => {
  const handleSignUpClick = () => {
    window.location.href = '/signup';
  };

  const handleSubscribeClick = (tier) => {
    window.location.href = '/signup';
  };

  return (
    <div className="min-h-screen">
      <Hero />
      <Tools onSignUpClick={handleSignUpClick} />
      <ToolShowcase />
      <UserShowcase />
      <Testimonials />
 {/*     <Subscription onSubscribeClick={handleSubscribeClick} /> */}
      <Footer />
    </div>
  );
};

export default Landing;