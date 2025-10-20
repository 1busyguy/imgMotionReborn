import React, { createContext, useMemo, useRef, useState, useCallback } from 'react';

export interface FlowNode<T = any> {
  id: string;
  position: { x: number; y: number };
  data: T;
  type?: string;
}

export interface FlowEdge<T = any> {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: T;
}

type NodesStateHook<T> = [FlowNode<T>[], React.Dispatch<React.SetStateAction<FlowNode<T>[]>>, (updated: FlowNode<T>[]) => void];
type EdgesStateHook<T> = [FlowEdge<T>[], React.Dispatch<React.SetStateAction<FlowEdge<T>[]>>, (updated: FlowEdge<T>[]) => void];

interface ReactFlowContextValue {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const ReactFlowContext = createContext<ReactFlowContextValue>({ nodes: [], edges: [] });

export const ReactFlowProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(() => ({ nodes: [], edges: [] }), []);
  return <ReactFlowContext.Provider value={value}>{children}</ReactFlowContext.Provider>;
};

interface ReactFlowProps<T = any> {
  nodes: FlowNode<T>[];
  edges: FlowEdge[];
  onNodesChange?: (updatedNodes: FlowNode<T>[]) => void;
  onEdgesChange?: (updatedEdges: FlowEdge[]) => void;
  onConnect?: (edge: FlowEdge) => void;
  onNodeClick?: (node: FlowNode<T>) => void;
  className?: string;
  children?: React.ReactNode;
  onDrop?: React.DragEventHandler<HTMLDivElement>;
  onDragOver?: React.DragEventHandler<HTMLDivElement>;
}

export const ReactFlow = <T,>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  className,
  children,
  onDrop,
  onDragOver,
}: ReactFlowProps<T>) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [draggingNode, setDraggingNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();

    const nextNodes = nodes.map(node => {
      if (node.id !== draggingNode.id) return node;
      const x = event.clientX - rect.left - draggingNode.offsetX;
      const y = event.clientY - rect.top - draggingNode.offsetY;
      return {
        ...node,
        position: {
          x: Math.max(0, Math.round(x)),
          y: Math.max(0, Math.round(y)),
        },
      };
    });

    onNodesChange?.(nextNodes);
  }, [draggingNode, nodes, onNodesChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-slate-950 ${className ?? ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={onDrop}
      onDragOver={onDragOver}
      role="application"
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {edges.map(edge => {
          const source = nodes.find(node => node.id === edge.source);
          const target = nodes.find(node => node.id === edge.target);
          if (!source || !target) return null;
          const x1 = source.position.x + 160;
          const y1 = source.position.y + 32;
          const x2 = target.position.x + 0;
          const y2 = target.position.y + 32;

          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(148, 163, 184, 0.3)"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          );
        })}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="rgba(148, 163, 184, 0.3)" />
          </marker>
        </defs>
      </svg>

      {nodes.map(node => (
        <button
          key={node.id}
          type="button"
          onMouseDown={event => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const offsetX = event.clientX - rect.left - node.position.x;
            const offsetY = event.clientY - rect.top - node.position.y;
            setDraggingNode({ id: node.id, offsetX, offsetY });
          }}
          onClick={event => {
            event.stopPropagation();
            onNodeClick?.(node);
          }}
          className="absolute w-80 cursor-grab rounded-xl border border-slate-700 bg-slate-900/90 p-4 text-left text-slate-100 shadow-lg transition hover:border-indigo-500 hover:bg-slate-900"
          style={{ transform: `translate(${node.position.x}px, ${node.position.y}px)` }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold uppercase tracking-wide text-indigo-300">{node.data?.label ?? node.id}</span>
            <span className="text-xs font-medium text-slate-400">{node.data?.status ?? 'idle'}</span>
          </div>
          {node.data?.description && (
            <p className="mt-2 text-xs text-slate-400">{node.data.description}</p>
          )}
          {node.data?.jobId && (
            <p className="mt-3 truncate text-[11px] text-slate-500">Job: {node.data.jobId}</p>
          )}
        </button>
      ))}

      {children}
    </div>
  );
};

export const useNodesState = <T,>(initialNodes: FlowNode<T>[]): NodesStateHook<T> => {
  const [nodes, setNodes] = useState<FlowNode<T>[]>(initialNodes);
  const onNodesChange = useCallback((updated: FlowNode<T>[]) => {
    setNodes(updated);
  }, []);
  return [nodes, setNodes, onNodesChange];
};

export const useEdgesState = <T,>(initialEdges: FlowEdge<T>[]): EdgesStateHook<T> => {
  const [edges, setEdges] = useState<FlowEdge<T>[]>(initialEdges);
  const onEdgesChange = useCallback((updated: FlowEdge<T>[]) => {
    setEdges(updated);
  }, []);
  return [edges, setEdges, onEdgesChange];
};

export const addEdge = <T,>(edge: FlowEdge<T>, edges: FlowEdge<T>[]): FlowEdge<T>[] => {
  return [...edges, edge];
};

export const Controls: React.FC = () => (
  <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500">
    Canvas Controls
  </div>
);

export const Background: React.FC<{ variant?: 'dots' | 'lines' }> = ({ variant = 'dots' }) => (
  <div
    aria-hidden="true"
    className={`pointer-events-none absolute inset-0 bg-[length:32px_32px] ${variant === 'dots' ? 'bg-[radial-gradient(circle,_rgba(30,41,59,0.5)_1px,_transparent_1px)]' : 'bg-[linear-gradient(90deg,_rgba(30,41,59,0.5)_1px,_transparent_1px),linear-gradient(rgba(30,41,59,0.5)_1px,_transparent_1px)]'}`}
  />
);

export const MiniMap: React.FC = () => (
  <div className="pointer-events-none absolute left-4 top-4 h-24 w-32 rounded-lg border border-slate-800 bg-slate-900/80 text-center text-[10px] uppercase tracking-wide text-slate-500">
    Mini Map
  </div>
);

export const useReactFlow = () => ({
  fitView: () => undefined,
  project: (position: { x: number; y: number }) => position,
});

export type { FlowNode as Node, FlowEdge as Edge };
