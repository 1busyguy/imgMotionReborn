import React from 'react';
import { Navigate } from 'react-router-dom';
import { allTools } from '../data/data';

interface BuilderRedirectProps {
  toolRoute: string;
}

const BuilderRedirect: React.FC<BuilderRedirectProps> = ({ toolRoute }) => {
  const tool = allTools.find(toolItem => toolItem.route === toolRoute);
  const state = tool ? { toolId: tool.id } : undefined;

  return <Navigate to="/builder" replace state={state} />;
};

export default BuilderRedirect;
