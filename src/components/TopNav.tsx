import React from 'react';
import { Film, Play, History } from 'lucide-react';

interface TopNavProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  activeTab: 'create' | 'export' | 'history';
  onTabChange: (tab: 'create' | 'export' | 'history') => void;
  onOpenCreateModal: () => void;
  savedCount: number;
  durationSeconds?: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  title,
  onTitleChange,
  activeTab,
  onTabChange,
  onOpenCreateModal,
  savedCount,
  durationSeconds = 8,
}) => {
  return (
    <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-30 px-4 md:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Zone 1: Brand & Project Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-rose-950">
            <Film className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Enter weather short title..."
              className="w-full bg-transparent text-sm md:text-base font-semibold text-neutral-100 border-b border-transparent hover:border-neutral-700 focus:border-rose-500 focus:outline-none transition-colors px-1 py-0.5 truncate"
              title="Click to rename project"
            />
            <div className="text-xs text-neutral-400 px-1">
              24 SKY ALERT Studio <span className="text-neutral-600">·</span> 9:16 Weather Shorts Maker
            </div>
          </div>
        </div>

        {/* Zone 2: Step Navigation */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => onTabChange('create')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'create'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>1. Studio Editor</span>
          </button>
          <button
            onClick={() => {
              onTabChange('create');
              onOpenCreateModal();
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'export'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <span>2. Preview & Export</span>
          </button>
          <button
            onClick={() => onTabChange('history')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>3. Saved Videos ({savedCount})</span>
          </button>
        </div>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCreateModal}
            className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shadow-rose-900 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Export {Math.round(durationSeconds)}s Short</span>
          </button>
        </div>
      </div>
    </header>
  );
};
