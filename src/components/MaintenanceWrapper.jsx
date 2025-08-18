import React from 'react';
import { useLocation } from 'react-router-dom';
import { useMaintenance } from '../hooks/useMaintenance';
import MaintenancePage from './MaintenancePage';

const MaintenanceWrapper = ({ children }) => {
  const location = useLocation();
  const { isMaintenanceMode, isRouteAllowed } = useMaintenance();

  // If maintenance mode is enabled and current route is not allowed
  if (isMaintenanceMode && !isRouteAllowed(location.pathname)) {
    return <MaintenancePage />;
  }

  // Normal app rendering
  return children;
};

export default MaintenanceWrapper;