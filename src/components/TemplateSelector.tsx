import React from 'react';
import { TemplateId } from '../types';
import { CheckCircle2, LayoutTemplate } from 'lucide-react';

interface TemplateSelectorProps {
  activeTemplate: TemplateId;
  onSelectTemplate: (templateId: TemplateId) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  activeTemplate,
  onSelectTemplate,
}) => {
  return (
    <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-200">
            Select Video Template
          </span>
        </div>
        <span className="text-[10px] text-neutral-400">
          Each template saves its own independent design settings
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Template 1 Card */}
        <button
          type="button"
          onClick={() => onSelectTemplate('template-1')}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeTemplate === 'template-1'
              ? 'border-amber-400 bg-amber-400/10 shadow-sm'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          {/* Mini 9:16 Schematic */}
          <div className="w-9 h-14 rounded-md bg-neutral-800 border border-neutral-700 p-1 flex flex-col justify-between shrink-0 overflow-hidden">
            <div className="bg-black rounded-sm p-1 space-y-0.5">
              <div className="w-full h-1 bg-amber-400 rounded-xs" />
              <div className="w-4/5 h-0.5 bg-white/80 rounded-xs" />
              <div className="w-full h-0.5 bg-amber-300/80 rounded-xs" />
              <div className="w-3/4 h-0.5 bg-white/80 rounded-xs" />
            </div>
            <div className="h-4 bg-neutral-700/80 rounded-xs" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-neutral-100">
                Template 1
              </span>
              {activeTemplate === 'template-1' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
            </div>
            <div className="text-[10px] font-medium text-amber-300 mt-0.5">
              DID YOU KNOW? Bullet Card
            </div>
            <div className="text-[10px] text-neutral-400 line-clamp-1">
              Alternating white/yellow bullets & full-canvas sequence
            </div>
          </div>
        </button>

        {/* Template 2 Card */}
        <button
          type="button"
          onClick={() => onSelectTemplate('template-2')}
          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
            activeTemplate === 'template-2'
              ? 'border-sky-400 bg-sky-500/10 shadow-sm'
              : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
          }`}
        >
          {/* Mini 9:16 Schematic matching Reference */}
          <div className="w-9 h-14 rounded-md bg-neutral-900 border border-neutral-700 flex flex-col justify-between shrink-0 overflow-hidden">
            <div className="bg-black h-[52%] p-1 flex flex-col items-center gap-0.5 border-b-2 border-sky-400">
              <div className="flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                <div className="w-3.5 h-0.5 bg-white rounded-xs" />
              </div>
              <div className="w-full h-0.5 bg-amber-400 rounded-xs mt-0.5" />
              <div className="w-full h-0.5 bg-white/90 rounded-xs" />
              <div className="w-4/5 h-0.5 bg-sky-400 rounded-xs" />
            </div>
            <div className="flex-1 bg-neutral-700/70" />
            <div className="h-1 bg-sky-400 w-full" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-neutral-100">
                Template 2
              </span>
              {activeTemplate === 'template-2' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              )}
            </div>
            <div className="text-[10px] font-medium text-sky-300 mt-0.5">
              2-Split Documentary Layout
            </div>
            <div className="text-[10px] text-neutral-400 line-clamp-1">
              Top black paragraph + blue divider + lower footage
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
