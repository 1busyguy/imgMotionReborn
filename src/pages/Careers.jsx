import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Briefcase, MapPin, Clock, DollarSign, Users, Code, Palette, Zap, Mail } from 'lucide-react';

const Careers = () => {
  const jobListings = [
    {
      id: 1,
      code: 'IMM-2025-001',
      title: 'Experienced Traditional Artist / Videographer',
      department: 'Creative',
      location: 'Remote',
      type: 'Full-time',
      salary: 'TBD',
      description: 'Join our creative team to bring stories to life using your artistic talent and visual storytelling skills.',
      requirements: [
        '5+ years of experience in traditional art, video production, or multimedia storytelling',
        'Strong portfolio showcasing visual storytelling, concept development, or cinematography',
        'Comfortable using digital tools for editing, animation, or post-production (e.g., Adobe Suite, DaVinci Resolve)',
        'Open to exploring AI tools to enhance creative workflows (e.g., image generators, video editing assistants)',
        'Understanding of composition, lighting, pacing, and narrative in visual media'
      ],
      icon: <Code className="w-6 h-6" />
    },
    {
      id: 2,
      code: 'IMM-2025-002',
      title: 'AI/ML Engineer',
      department: 'AI Research',
      location: 'Remote',
      type: 'Full-time',
      salary: '$140,000 - $180,000',
      description: 'Lead the development and optimization of our AI models for image and video generation. Work with cutting-edge technologies.',
      requirements: [
        'PhD or Masters in Computer Science, AI, or related field',
        'Experience with PyTorch, TensorFlow, or similar frameworks',
        'Knowledge of computer vision and generative models',
        'Experience with model optimization and deployment',
        'Published research in AI/ML conferences preferred'
      ],
      icon: <Zap className="w-6 h-6" />
    },
    {
      id: 3,
      code: 'IMM-2025-003',
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      salary: '$90,000 - $120,000',
      description: 'Shape the user experience of our AI creative platform. Design intuitive interfaces that make complex AI tools accessible to everyone.',
      requirements: [
        '4+ years of product design experience',
        'Proficiency in Figma, Sketch, or similar design tools',
        'Experience designing for web and mobile applications',
        'Strong understanding of user research and testing',
        'Portfolio showcasing complex product design work'
      ],
      icon: <Palette className="w-6 h-6" />
    },
    {
      id: 4,
      code: 'IMM-2025-004',
      title: 'DevOps Engineer',
      department: 'Infrastructure',
      location: 'Remote',
      type: 'Full-time',
      salary: '$110,000 - $140,000',
      description: 'Build and maintain scalable infrastructure for our AI-powered platform. Ensure high availability and performance.',
      requirements: [
        '3+ years of DevOps/Infrastructure experience',
        'Experience with Docker, Kubernetes, and CI/CD pipelines',
        'Knowledge of cloud platforms (AWS, GCP preferred)',
        'Experience with monitoring and logging tools',
        'Understanding of security best practices'
      ],
      icon: <Users className="w-6 h-6" />
    },
    {
      id: 5,
      code: 'IMM-2025-005',
      title: 'Customer Success Manager',
      department: 'Customer Success',
      location: 'Remote',
      type: 'Full-time',
      salary: '$70,000 - $90,000',
      description: 'Help our users succeed with imgMotionMagic. Provide support, gather feedback, and drive user engagement and retention.',
      requirements: [
        '3+ years of customer success or support experience',
        'Excellent communication and problem-solving skills',
        'Experience with SaaS platforms and subscription models',
        'Knowledge of AI/creative tools preferred',
        'Ability to work across multiple time zones'
      ],
      icon: <Users className="w-6 h-6" />
    },
    {
      id: 6,
      code: 'IMM-2025-006',
      title: 'Marketing Manager',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      salary: '$80,000 - $100,000',
      description: 'Drive growth and brand awareness for imgMotionMagic. Develop marketing strategies and campaigns for our AI creative platform.',
      requirements: [
        '4+ years of digital marketing experience',
        'Experience with SaaS or tech product marketing',
        'Knowledge of content marketing and social media',
        'Analytics and data-driven decision making',
        'Experience with creative/design tools preferred'
      ],
      icon: <Briefcase className="w-6 h-6" />
    }
  ];

  const benefits = [
    'Competitive salary and equity package',
    'Comprehensive health, dental, and vision insurance',
    'Unlimited PTO and flexible working hours',
    'Remote-first culture with optional office access',
    '$2,000 annual learning and development budget',
    'Top-tier equipment and home office setup',
    'Stock options in a fast-growing AI company',
    'Quarterly team retreats and company events'
  ];

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
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white">Careers</h1>
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
            Join Our Team
          </h1>
          <p className="text-xl text-purple-200 max-w-3xl mx-auto mb-8">
            Help us democratize AI-powered creativity. We're building the future of content creation, 
            and we want passionate, talented people to join us on this journey.
          </p>
          <div className="flex items-center justify-center space-x-8 text-purple-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{jobListings.length}</div>
              <div className="text-sm">Open Positions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">100%</div>
              <div className="text-sm">Remote</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">50+</div>
              <div className="text-sm">Team Members</div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-12">
          <h2 className="text-3xl font-bold text-white mb-6 text-center">Why Work With Us?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <span className="text-purple-200">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Job Listings */}
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white text-center mb-8">Open Positions</h2>
          
          {jobListings.map((job) => (
            <div
              key={job.id}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-6 hover:bg-white/15 transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-start space-x-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                      {job.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{job.title}</h3>
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full text-xs font-medium">
                          {job.code}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm text-purple-200 mb-3">
                        <div className="flex items-center space-x-1">
                          <Briefcase className="w-4 h-4" />
                          <span>{job.department}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-4 h-4" />
                          <span>{job.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{job.type}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="w-4 h-4" />
                          <span>{job.salary}</span>
                        </div>
                      </div>
                      
                      <p className="text-purple-200 mb-4">{job.description}</p>
                      
                      <div>
                        <h4 className="text-white font-semibold mb-2">Key Requirements:</h4>
                        <ul className="text-purple-200 text-sm space-y-1">
                          {job.requirements.slice(0, 3).map((req, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                              <span>{req}</span>
                            </li>
                          ))}
                          {job.requirements.length > 3 && (
                            <li className="text-purple-300 text-xs">
                              +{job.requirements.length - 3} more requirements
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:ml-6 mt-4 lg:mt-0">
                  <a
                    href={`mailto:imgmotionapp@gmail.com?subject=${job.code}&body=Hi,%0D%0A%0D%0AI'm interested in the ${job.title} position (${job.code}).%0D%0A%0D%0APlease find my resume attached.%0D%0A%0D%0ABest regards`}
                    className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Apply Now</span>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Application Instructions */}
        <div className="mt-12 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">How to Apply</h3>
          <div className="max-w-3xl mx-auto">
            <p className="text-purple-200 mb-6">
              Ready to join our team? Here's how to apply for any of our open positions:
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white/10 rounded-xl p-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Choose Position</h4>
                <p className="text-purple-200 text-sm">Find the role that matches your skills and interests</p>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Email Us</h4>
                <p className="text-purple-200 text-sm">Send your resume to imgmotionapp@gmail.com with the job code as subject</p>
              </div>
              
              <div className="bg-white/10 rounded-xl p-4">
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="text-white font-semibold mb-2">Interview Process</h4>
                <p className="text-purple-200 text-sm">We'll review your application and reach out within 1-2 weeks</p>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-purple-200 text-sm">
                <strong className="text-white">Important:</strong> Please include the job code (e.g., IMM-2025-001) in your email subject line. 
                This helps us route your application to the right team quickly.
              </p>
            </div>
          </div>
        </div>

        {/* Company Culture */}
        <div className="mt-12 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Our Culture</h3>
          <p className="text-purple-200 max-w-3xl mx-auto mb-8">
            We're a remote-first company that values creativity, innovation, and work-life balance. 
            Our team is passionate about democratizing AI technology and making it accessible to creators worldwide.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Innovation First</h4>
              <p className="text-purple-200 text-sm">
                We encourage experimentation and creative problem-solving. Your ideas matter.
              </p>
            </div>
            
            <div className="bg-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Remote Flexibility</h4>
              <p className="text-purple-200 text-sm">
                Work from anywhere with flexible hours that fit your lifestyle and productivity.
              </p>
            </div>
            
            <div className="bg-white/10 rounded-xl p-6">
              <h4 className="text-white font-semibold mb-2">Growth Mindset</h4>
              <p className="text-purple-200 text-sm">
                Continuous learning and professional development are core to our success.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Careers;