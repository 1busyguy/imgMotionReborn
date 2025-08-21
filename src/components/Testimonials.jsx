import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toCdnUrl } from '../utils/cdnHelpers';
import { Star, Quote } from 'lucide-react';

const Testimonials = () => {
  const navigate = useNavigate();

  const testimonials = [
    {
      id: 1,
      name: "Sarah Chen",
      role: "Content Creator",
      avatar: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "imgMotionMagic has completely transformed my content creation workflow. The AI tools are incredibly intuitive and produce professional-quality results every time.",
      rating: 5
    },
    {
      id: 2,
      name: "Marcus Rodriguez",
      role: "Digital Marketer",
      avatar: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "The video generation tools are absolutely mind-blowing. I can create engaging social media content in minutes instead of hours.",
      rating: 5
    },
    {
      id: 3,
      name: "Emily Johnson",
      role: "Freelance Designer",
      avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "As a freelancer, imgMotionMagic gives me superpowers. I can offer my clients services I never thought possible before.",
      rating: 5
    },
    {
      id: 4,
      name: "David Kim",
      role: "YouTuber",
      avatar: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "The quality of AI-generated videos is incredible. My subscribers can't believe these are made with AI. Game-changer for content creators!",
      rating: 5
    },
    {
      id: 5,
      name: "Lisa Thompson",
      role: "Social Media Manager",
      avatar: "https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "The token system is fair and transparent. I love how I can scale my usage based on my needs. Perfect for agencies like ours.",
      rating: 5
    },
    {
      id: 6,
      name: "Alex Rivera",
      role: "Creative Director",
      avatar: "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "The variety of AI models available is impressive. From FLUX to VEO2, I have access to cutting-edge technology all in one platform.",
      rating: 5
    },
    {
      id: 7,
      name: "Jennifer Walsh",
      role: "Brand Strategist",
      avatar: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "Customer support is fantastic and the community is so helpful. It's more than just a tool - it's a creative ecosystem.",
      rating: 5
    },
    {
      id: 8,
      name: "Michael Chang",
      role: "Video Producer",
      avatar: "https://images.pexels.com/photos/1212984/pexels-photo-1212984.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=1",
      text: "I've tried many AI video tools, but imgMotionMagic consistently delivers the best results. The motion quality is simply outstanding.",
      rating: 5
    }
  ];

  // Duplicate testimonials for seamless loop
  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
            Loved by Creators Worldwide
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join the many satisfied creators who are transforming their content with our AI tools.
          </p>
        </div>
      </div>

      {/* Scrolling Testimonials Marquee */}
      <div className="relative">
        <div className="flex animate-scroll space-x-8">
          {duplicatedTestimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.id}-${index}`}
              className="flex-shrink-0 w-96 bg-white rounded-2xl shadow-lg p-6 border border-gray-100"
            >
              <div className="flex items-start space-x-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <img
                    src={toCdnUrl(testimonial.avatar)}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                    loading="lazy"
                  />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Stars */}
                  <div className="flex items-center space-x-1 mb-2">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  {/* Quote */}
                  <div className="relative">
                    <Quote className="absolute -top-2 -left-2 w-6 h-6 text-purple-200" />
                    <p className="text-gray-700 text-sm leading-relaxed mb-3 pl-4">
                      {testimonial.text}
                    </p>
                  </div>
                  
                  {/* Author */}
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{testimonial.name}</p>
                    <p className="text-purple-600 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Gradient Overlays */}
        <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-purple-50 to-transparent pointer-events-none z-10"></div>
        <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-pink-50 to-transparent pointer-events-none z-10"></div>
      </div>

        {/* Call to Action 
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 text-center">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl p-8 text-white">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Join Our Creative Community?
          </h3>
          <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
            Start creating amazing content with our AI tools today. Get 100 free tokens to start!
          </p>
          <button 
            onClick={() => navigate('/signup')}
            className="bg-white text-purple-600 hover:bg-gray-50 font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            Start Creating Now
          </button>
        </div>
      </div>  */}

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        
        .animate-scroll {
          animation: scroll 60s linear infinite;
        }
        
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
};

export default Testimonials;