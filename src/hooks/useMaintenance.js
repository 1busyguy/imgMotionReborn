import { useState, useEffect } from 'react';
import { maintenanceConfig } from '../config/maintenance';

export const useMaintenance = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [config, setConfig] = useState(maintenanceConfig);

  useEffect(() => {
    // Check maintenance status
    const checkMaintenanceStatus = () => {
      try {
        // Re-import the config to get latest values
        // This allows for hot-reloading of maintenance status
        setIsMaintenanceMode(maintenanceConfig.enabled);
        setConfig(maintenanceConfig);
      } catch (error) {
        console.error('Error checking maintenance status:', error);
        // Default to not in maintenance mode if there's an error
        setIsMaintenanceMode(false);
      }
    };

    checkMaintenanceStatus();

    // Check every 30 seconds for maintenance status changes
    const interval = setInterval(checkMaintenanceStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const isRouteAllowed = (pathname) => {
    if (!isMaintenanceMode) return true;
    
    // Always allow the maintenance page itself
    if (pathname === '/maintenance') return true;
    
    // Check if route is in allowed list
    return config.allowedRoutes.some(route => 
      pathname.startsWith(route)
    );
  };

  return {
    isMaintenanceMode,
    config,
    isRouteAllowed
  };
};