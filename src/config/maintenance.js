// Maintenance Mode Configuration
// Set enabled: true to activate maintenance mode
// Set enabled: false to disable maintenance mode

export const maintenanceConfig = {
  enabled: false, // Change this to true to enable maintenance mode
  
  // Maintenance page content
  title: "imgMotionMagic is Getting Better",
  subtitle: "We're making some exciting improvements",
  message: "Our AI-powered creative platform is temporarily offline while we enhance your experience with new features and improvements.",
  
  // Estimated completion
  estimatedCompletion: "We'll be back online soon",
  
  // Contact information
  contactEmail: "imgmotionapp@gmail.com",
  
  // Social links (optional)
  socialLinks: {
    twitter: "#",
    instagram: "#",
    youtube: "#"
  },
  
  // Allow specific routes during maintenance (for admin access)
  allowedRoutes: [
    // Add routes that should work during maintenance
    // Example: '/admin', '/health-check'
  ],
  
  // Custom styling
  theme: {
    primaryColor: "#8B5CF6",
    secondaryColor: "#EC4899",
    backgroundColor: "from-purple-900 via-blue-900 to-indigo-900"
  }
};