import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { allTools } from '../data/data';
import { BuilderProvider, useBuilder } from '../contexts/BuilderContext';
import { ReactFlow, ReactFlowProvider, Background, Controls, MiniMap } from '../lib/reactFlowStub';

const ToolPalette: React.FC<{ onAdd: (toolId: number) => void }> = ({ onAdd }) => {
  return (
    <aside className="flex h-full w-64 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950/80 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Tool Library</h2>
      <p className="mt-1 text-xs text-slate-500">Drag tools into the canvas or click to add them.</p>
      <div className="mt-4 space-y-3">
        {allTools.map(tool => (
          <button
            key={tool.id}
            type="button"
            draggable
            onDragStart={event => {
              event.dataTransfer.setData('application/tool-id', String(tool.id));
            }}
            onClick={() => onAdd(tool.id)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-left transition hover:border-indigo-500 hover:bg-slate-900"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-indigo-200">
              <span>{tool.name}</span>
              <span className="text-[11px] uppercase text-slate-500">{tool.category}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{tool.description}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Tokens: {tool.tokensRequired ?? '—'}</span>
              <span>Type: {tool.toolType ?? 'n/a'}</span>
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
};

const InspectorPanel: React.FC = () => {
  const { selectedNode, updateNodeConfig, removeNode, runNode, runningState } = useBuilder();
  const [configDraft, setConfigDraft] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNode) {
      setConfigDraft('');
      setConfigError(null);
      return;
    }
    setConfigDraft(JSON.stringify(selectedNode.data.config, null, 2));
  }, [selectedNode]);

  const handleApply = () => {
    if (!selectedNode) return;
    try {
      const parsed = configDraft.trim() ? JSON.parse(configDraft) : {};
      updateNodeConfig(selectedNode.id, parsed);
      setConfigError(null);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Invalid configuration JSON');
    }
  };

  const handleRun = async () => {
    if (!selectedNode) return;
    setConfigError(null);
    try {
      await runNode(selectedNode.id);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Failed to run tool');
    }
  };

  const runtimeStatus = selectedNode ? runningState[selectedNode.id] : undefined;

  if (!selectedNode) {
    return (
      <aside className="flex h-full w-80 flex-col border-l border-slate-800 bg-slate-950/60 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Inspector</h2>
        <p className="mt-6 text-sm text-slate-500">Select a node on the canvas to configure it.</p>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-96 flex-col border-l border-slate-800 bg-slate-950/80 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-indigo-200">{selectedNode.data.label}</h2>
          <p className="text-xs text-slate-500">{selectedNode.data.toolType}</p>
        </div>
        <button
          type="button"
          onClick={() => removeNode(selectedNode.id)}
          className="rounded-lg border border-red-500/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-400 transition hover:bg-red-500/10"
        >
          Remove
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-400">
        <div className="flex items-center justify-between">
          <span>Status: {selectedNode.data.status}</span>
          {runtimeStatus?.jobId && <span className="text-[11px] text-slate-500">Job {runtimeStatus.jobId}</span>}
        </div>
        {selectedNode.data.outputUrl && (
          <a
            href={selectedNode.data.outputUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[11px] text-indigo-300 hover:text-indigo-200"
          >
            View Result
          </a>
        )}
        {selectedNode.data.error && (
          <p className="mt-2 text-[11px] text-red-400">{selectedNode.data.error}</p>
        )}
      </div>

      <label className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Configuration (JSON)
      </label>
      <textarea
        value={configDraft}
        onChange={event => setConfigDraft(event.target.value)}
        className="mt-2 h-64 w-full rounded-lg border border-slate-800 bg-slate-900/80 p-3 font-mono text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
        spellCheck={false}
      />
      {configError && <p className="mt-2 text-xs text-red-400">{configError}</p>}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
        >
          Save Configuration
        </button>
        <button
          type="button"
          onClick={handleRun}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Run Node
        </button>
      </div>
    </aside>
  );
};

const CanvasSurface: React.FC = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, addNodeFromTool, setSelectedNodeId } = useBuilder();
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const toolId = Number(event.dataTransfer.getData('application/tool-id'));
    if (!Number.isFinite(toolId)) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    const position = {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
    addNodeFromTool(toolId, position);
  };

  return (
    <div ref={canvasRef} className="relative flex-1" onDrop={handleDrop} onDragOver={event => event.preventDefault()}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={node => setSelectedNodeId(node.id)}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

const BuilderLayout: React.FC = () => {
  const location = useLocation();
  const { addNodeFromTool } = useBuilder();
  const initialToolId = useMemo(() => {
    if (location.state && typeof (location.state as any).toolId !== 'undefined') {
      return Number((location.state as any).toolId);
    }
    return undefined;
  }, [location.state]);

  useEffect(() => {
    if (typeof initialToolId === 'number' && Number.isFinite(initialToolId)) {
      addNodeFromTool(initialToolId);
    }
  }, [initialToolId, addNodeFromTool]);

  return (
    <div className="flex h-full w-full">
      <ToolPalette onAdd={addNodeFromTool} />
      <CanvasSurface />
      <InspectorPanel />
    </div>
  );
};

const CanvasBuilder: React.FC = () => {
  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100">
      <BuilderProvider>
        <BuilderLayout />
      </BuilderProvider>
    </div>
  );
};

export default CanvasBuilder;
