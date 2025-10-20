import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FlowNode, FlowEdge } from '../lib/reactFlowStub';
import { useNodesState, useEdgesState } from '../lib/reactFlowStub';
import { useAuth } from '../hooks/useAuth';
import { useRealtimeActivity } from '../hooks/useRealtimeActivity';
import { allTools } from '../data/data';
import { executeToolRun, ToolExecutionOptions } from '../utils/toolExecution';

interface BuilderNodeData {
  toolId: number;
  toolType?: string;
  label: string;
  description?: string;
  config: Record<string, any>;
  status: 'idle' | 'running' | 'completed' | 'failed';
  jobId?: string;
  outputUrl?: string | null;
  error?: string | null;
  tokens?: number;
}

interface BuilderContextValue {
  nodes: FlowNode<BuilderNodeData>[];
  edges: FlowEdge[];
  onNodesChange: (updated: FlowNode<BuilderNodeData>[]) => void;
  onEdgesChange: (updated: FlowEdge[]) => void;
  addNodeFromTool: (toolId: number, position?: { x: number; y: number }) => void;
  updateNodeConfig: (nodeId: string, config: Record<string, any>) => void;
  removeNode: (nodeId: string) => void;
  runNode: (nodeId: string) => Promise<void>;
  setSelectedNodeId: (nodeId: string | null) => void;
  selectedNode: FlowNode<BuilderNodeData> | null;
  recentActivity: any[];
  runningState: Record<string, { status: string; jobId?: string }>;
}

const BuilderContext = createContext<BuilderContextValue | undefined>(undefined);

const parseTokens = (value: string | number | undefined): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const numeric = parseInt(String(value).replace(/[^\d]/g, ''), 10);
  return Number.isNaN(numeric) ? 0 : numeric;
};

const getDefaultConfig = (tool: any) => {
  if (!tool) return { prompt: '', settings: {} };

  switch (tool.toolType) {
    case 'fal_seedream_v4_text2image':
      return { prompt: '', negativePrompt: '', guidanceScale: 3.5, aspectRatio: '1:1' };
    case 'fal_seedream_v4_edit':
      return { prompt: '', imageUrl: '', maskUrl: '', strength: 0.65 };
    case 'fal_seedance_pro':
      return { prompt: '', imageUrl: '', duration: '5', resolution: '480p', cameraFixed: false, seed: -1 };
    case 'fal_wan_v22_img2video_lora':
      return { prompt: '', imageUrl: '', resolution: '720p', motionStrength: 0.5 };
    case 'fal_seedance_reference_to_video':
      return { prompt: '', referenceImages: [], duration: '5', resolution: '480p' };
    default:
      return { prompt: '', settings: {} };
  }
};

export const BuilderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<unknown>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [runningState, setRunningState] = useState<Record<string, { status: string; jobId?: string }>>({});
  const { recentActivity } = useRealtimeActivity(user?.id);

  useEffect(() => {
    if (!recentActivity?.length) return;

    setNodes(prevNodes =>
      prevNodes.map(node => {
        if (!node.data.jobId) return node;
        const activity = recentActivity.find(item => item.id === node.data.jobId);
        if (!activity) return node;
        return {
          ...node,
          data: {
            ...node.data,
            status: activity.status,
            outputUrl: activity.output_file_url,
          },
        };
      }),
    );

    setRunningState(prev => {
      const nextState = { ...prev };
      Object.entries(prev).forEach(([nodeId, state]) => {
        if (!state.jobId) return;
        const activity = recentActivity.find(item => item.id === state.jobId);
        if (!activity) return;
        nextState[nodeId] = {
          ...state,
          status: activity.status,
        };
      });
      return nextState;
    });
  }, [recentActivity, setNodes]);

  const addNodeFromTool = useCallback((toolId: number, position?: { x: number; y: number }) => {
    const tool = allTools.find(item => item.id === toolId);
    if (!tool) return;

    const nodeId = `tool-${toolId}-${Date.now()}`;
    const basePosition = position ?? { x: 200, y: 120 + nodes.length * 40 };

    const newNode: FlowNode<BuilderNodeData> = {
      id: nodeId,
      position: basePosition,
      data: {
        toolId,
        toolType: tool.toolType,
        label: tool.name,
        description: tool.description,
        config: getDefaultConfig(tool),
        status: 'idle',
        jobId: undefined,
        tokens: parseTokens(tool.tokensRequired),
      },
      type: 'tool',
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(nodeId);
  }, [nodes.length, setNodes]);

  const updateNodeConfig = useCallback((nodeId: string, config: Record<string, any>) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: { ...node.data.config, ...config },
              },
            }
          : node,
      ),
    );
  }, [setNodes]);

  const removeNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setEdges(prev => prev.filter(edge => edge.source !== nodeId && edge.target !== nodeId));
    setRunningState(prev => {
      const { [nodeId]: _removed, ...rest } = prev;
      return rest;
    });
    setSelectedNodeId(prev => (prev === nodeId ? null : prev));
  }, [setEdges, setNodes]);

  const runNode = useCallback(async (nodeId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to run a tool.');
    }

    const node = nodes.find(item => item.id === nodeId);
    if (!node) return;
    if (!node.data.toolType) {
      throw new Error('Selected node does not have an associated tool type.');
    }

    const options: ToolExecutionOptions = {
      toolType: node.data.toolType,
      edgeFunction: node.data.toolType,
      tokensRequired: node.data.tokens ?? 0,
      generationName: node.data.label,
      input: node.data.config,
      onGenerationCreated: generation => {
        setNodes(prevNodes =>
          prevNodes.map(prevNode =>
            prevNode.id === nodeId
              ? {
                  ...prevNode,
                  data: {
                    ...prevNode.data,
                    jobId: generation.id,
                    status: 'running',
                  },
                }
              : prevNode,
          ),
        );
        setRunningState(prev => ({
          ...prev,
          [nodeId]: {
            status: 'running',
            jobId: generation.id,
          },
        }));
      },
    };

    try {
      await executeToolRun(options);
    } catch (error) {
      setNodes(prevNodes =>
        prevNodes.map(prevNode =>
          prevNode.id === nodeId
            ? {
                ...prevNode,
                data: {
                  ...prevNode.data,
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              }
            : prevNode,
        ),
      );
      setRunningState(prev => ({
        ...prev,
        [nodeId]: {
          status: 'failed',
          jobId: prev[nodeId]?.jobId,
        },
      }));
      throw error;
    }
  }, [nodes, setNodes, user]);

  const value = useMemo<BuilderContextValue>(() => {
    const selectedNode = nodes.find(node => node.id === selectedNodeId) ?? null;

    return {
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      addNodeFromTool,
      updateNodeConfig,
      removeNode,
      runNode,
      setSelectedNodeId,
      selectedNode,
      recentActivity,
      runningState,
    };
  }, [nodes, edges, onNodesChange, onEdgesChange, addNodeFromTool, updateNodeConfig, removeNode, runNode, selectedNodeId, recentActivity, runningState, setSelectedNodeId]);

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
};

export const useBuilder = () => {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
};
