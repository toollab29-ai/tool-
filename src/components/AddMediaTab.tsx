import React, { useRef, useState } from 'react';
import { BackgroundFitMode, ImageSequenceSlot, TemplateId } from '../types';
import {
  detectMediaFileType,
  prepareCompatibleImageUrl,
  prepareCompatibleVideoUrl,
} from '../utils/mediaLoader';
import { getDefaultEndZoomForSlot } from '../utils/keyframeAnimation';
import {
  Upload,
  X,
  Check,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
  Clock,
  Trash2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
}

interface AddMediaTabProps {
  activeTemplate?: TemplateId;
  currentMediaUrl: string;
  currentMediaName: string;
  currentMediaType?: 'image' | 'video';
  mediaLoadError?: string | null;
  bgFitMode?: BackgroundFitMode;
  imageSequence: ImageSequenceSlot[];
  activeSequenceIndex: 0 | 1 | 2;
  onSelectMedia: (url: string, name: string, type: 'image' | 'video') => void;
  onRemoveBackgroundMedia?: () => void;
  onChangeBgFitMode?: (mode: BackgroundFitMode) => void;
  onResetBgTransform?: () => void;
  onAssignSequenceSlot: (
    slotIndex: 0 | 1 | 2,
    url: string,
    name: string,
    type: 'image' | 'video'
  ) => void;
  onUpdateSequenceSlot: (
    slotIndex: 0 | 1 | 2,
    updated: Partial<ImageSequenceSlot>
  ) => void;
  onRemoveSequenceSlot: (slotIndex: 0 | 1 | 2) => void;
  onSelectSequenceSlot: (slotIndex: 0 | 1 | 2, jumpPlayhead?: boolean) => void;
  onNext: () => void;
}

export const AddMediaTab: React.FC<AddMediaTabProps> = ({
  activeTemplate = 'template-1',
  currentMediaUrl,
  currentMediaName,
  currentMediaType = 'video',
  mediaLoadError,
  bgFitMode = 'fill',
  imageSequence,
  activeSequenceIndex,
  onSelectMedia,
  onRemoveBackgroundMedia,
  onChangeBgFitMode,
  onResetBgTransform,
  onAssignSequenceSlot,
  onUpdateSequenceSlot,
  onRemoveSequenceSlot,
  onSelectSequenceSlot,
  onNext,
}) => {
  const bgInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const batchInputRef = useRef<HTMLInputElement>(null);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const decodeUploadedFiles = async (files: FileList | null): Promise<MediaItem[]> => {
    if (!files || files.length === 0) return [];
    const added: MediaItem[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const detected = detectMediaFileType(file);
      if (!detected) {
        errors.push(
          `Unsupported file format "${file.name}". Please upload MP4, WebM, MOV, JPG, PNG, or WebP.`
        );
        continue;
      }

      try {
        const url =
          detected === 'image'
            ? await prepareCompatibleImageUrl(file)
            : await prepareCompatibleVideoUrl(file);

        added.push({
          id: `upload-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          url,
          name: file.name,
          type: detected,
        });
      } catch (err) {
        errors.push(
          err instanceof Error
            ? err.message
            : `Failed to load "${file.name}".`
        );
      }
    }

    if (errors.length > 0) {
      setUploadError(errors.join(' '));
    } else if (added.length > 0) {
      setUploadError(null);
    }

    return added;
  };

  const handleUploadBg = async (files: FileList | null) => {
    setUploadError(null);
    setIsProcessing(true);
    try {
      const added = await decodeUploadedFiles(files);
      if (added.length > 0) {
        setMediaList((prev) => [...added, ...prev]);
        onSelectMedia(added[0].url, added[0].name, added[0].type);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadSlot = async (
    files: FileList | null,
    startSlotIndex: 0 | 1 | 2
  ) => {
    setUploadError(null);
    setIsProcessing(true);
    try {
      const added = await decodeUploadedFiles(files);
      if (added.length > 0) {
        setMediaList((prev) => [...added, ...prev]);
        added.slice(0, 3 - startSlotIndex).forEach((item, offset) => {
          const targetIdx = (startSlotIndex + offset) as 0 | 1 | 2;
          onAssignSequenceSlot(targetIdx, item.url, item.name, item.type);
        });
        onSelectSequenceSlot(startSlotIndex, true);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveLibraryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMediaList((prev) => {
      const removed = prev.find((m) => m.id === id);
      const updated = prev.filter((m) => m.id !== id);
      if (removed) {
        if (currentMediaUrl === removed.url) {
          if (updated.length > 0) {
            onSelectMedia(updated[0].url, updated[0].name, updated[0].type);
          } else if (onRemoveBackgroundMedia) {
            onRemoveBackgroundMedia();
          } else {
            onSelectMedia('', '', 'video');
          }
        }
        imageSequence.forEach((slot, idx) => {
          if (slot.url === removed.url) {
            onRemoveSequenceSlot(idx as 0 | 1 | 2);
          }
        });
      }
      return updated;
    });
  };

  const populatedCount = imageSequence.filter((s) => !!s.url).length;
  const displayedError = uploadError || mediaLoadError;

  return (
    <div className="space-y-6">
      {displayedError && (
        <div className="bg-rose-950/60 border border-rose-500/60 text-rose-200 rounded-xl p-3 text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{displayedError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-300 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Layer 1: Background Weather Video / Image */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
              <Film className="w-3.5 h-3.5" />
              Layer 1 · Background Weather Footage
              {activeTemplate === 'template-2' && (
                <span className="text-[10px] font-normal text-sky-300 ml-1">
                  (Template 2)
                </span>
              )}
            </span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Renders behind all elements. Supports MP4, WebM, JPG, PNG & WebP.
            </p>
          </div>

          {currentMediaUrl && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => bgInputRef.current?.click()}
                className="px-2.5 py-1.5 text-[11px] font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveBackgroundMedia) {
                    onRemoveBackgroundMedia();
                  } else {
                    onSelectMedia('', '', 'video');
                  }
                }}
                className="px-2.5 py-1.5 text-[11px] font-medium bg-neutral-900 hover:bg-rose-950 text-rose-400 border border-rose-900/40 rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>

        <input
          ref={bgInputRef}
          type="file"
          accept=".mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,image/*,video/*"
          onChange={(e) => {
            handleUploadBg(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />

        {!currentMediaUrl ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragTarget('bg');
            }}
            onDragLeave={() => setDragTarget(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragTarget(null);
              handleUploadBg(e.dataTransfer.files);
            }}
            onClick={() => bgInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              dragTarget === 'bg'
                ? 'border-rose-500 bg-rose-950/20'
                : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/70'
            }`}
          >
            <Upload className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
            <div className="text-xs font-semibold text-neutral-200">
              Upload Background Video or Image
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">
              MP4, WEBM, MOV, JPG, PNG, WEBP
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded overflow-hidden bg-black border border-neutral-800 shrink-0">
                  {currentMediaType === 'video' ? (
                    <video
                      src={currentMediaUrl}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img
                      src={currentMediaUrl}
                      alt={currentMediaName}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-neutral-200 truncate font-medium">
                    {currentMediaName || 'Background media active'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    {currentMediaType === 'video' ? 'Video Ready' : 'Image Ready'} · Layer 1
                  </div>
                </div>
              </div>

              {onResetBgTransform && (
                <button
                  type="button"
                  onClick={onResetBgTransform}
                  className="px-2 py-1 rounded bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-300 flex items-center gap-1 cursor-pointer shrink-0"
                  title="Reset background scale and position"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Pos/Zoom</span>
                </button>
              )}
            </div>

            {onChangeBgFitMode && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-neutral-900/60 border border-neutral-800/80 rounded-lg px-2.5 py-2">
                <span className="text-[11px] text-neutral-400 font-medium">
                  Background Fit:
                </span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'fill', label: 'Fill (No Gaps)' },
                      { id: 'fit', label: 'Fit Whole' },
                      { id: 'custom', label: 'Custom' },
                    ] as { id: BackgroundFitMode; label: string }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onChangeBgFitMode(m.id)}
                      className={`px-2.5 py-1 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                        bgFitMode === m.id
                          ? 'bg-rose-600 text-white border-rose-500'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-800'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* IMAGE SEQUENCE: Exactly 3 Sequential Image Slots */}
      <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>IMAGE SEQUENCE ({populatedCount} / 3 Uploaded)</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Images display one after another with automatic zoom keyframes behind the black panel.
            </p>
          </div>

          <div>
            <input
              ref={batchInputRef}
              type="file"
              accept=".mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,image/*,video/*"
              multiple
              onChange={(e) => {
                handleUploadSlot(e.target.files, 0);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>Upload Up to 3 Images</span>
            </button>
          </div>
        </div>

        {/* 3 Independent Image Slots */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([0, 1, 2] as const).map((idx) => {
            const slot = imageSequence[idx];
            if (!slot) return null;
            const isSelected = activeSequenceIndex === idx;
            const defaultPeak = Math.round(getDefaultEndZoomForSlot(slot.slotNumber) * 100);

            return (
              <div
                key={slot.id}
                onClick={() => onSelectSequenceSlot(idx, !!slot.url)}
                className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/30'
                    : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <input
                  ref={slotInputRefs[idx]}
                  type="file"
                  accept=".mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,image/*,video/*"
                  onChange={(e) => {
                    handleUploadSlot(e.target.files, idx);
                    e.target.value = '';
                  }}
                  className="hidden"
                />

                {/* Slot Header & Timing */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-neutral-100">
                    Image {slot.slotNumber}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-amber-300 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {slot.startTime.toFixed(1)}–{slot.endTime.toFixed(1)}s
                  </span>
                </div>

                {/* Slot Preview or Dropzone */}
                {slot.url ? (
                  <div className="relative aspect-4/3 rounded-lg overflow-hidden bg-black border border-neutral-800 group">
                    {slot.type === 'video' ? (
                      <video
                        src={slot.url}
                        className="w-full h-full object-cover"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                    ) : (
                      <img
                        src={slot.url}
                        alt={slot.name}
                        className="w-full h-full object-cover"
                      />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveSequenceSlot(idx);
                      }}
                      title={`Remove Image ${slot.slotNumber}`}
                      className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/80 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-amber-300 truncate">
                      {slot.keyframes?.length
                        ? `${slot.keyframes.length} KFs · ${Math.round(
                            slot.keyframes[0].zoom * 100
                          )}%→${Math.round(
                            slot.keyframes[slot.keyframes.length - 1].zoom * 100
                          )}%`
                        : `Static ${Math.round(slot.zoom * 100)}%`}
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragTarget(slot.id);
                    }}
                    onDragLeave={() => setDragTarget(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragTarget(null);
                      handleUploadSlot(e.dataTransfer.files, idx);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      slotInputRefs[idx].current?.click();
                    }}
                    className={`aspect-4/3 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-2 text-center transition-colors ${
                      dragTarget === slot.id
                        ? 'border-amber-400 bg-amber-950/25'
                        : 'border-neutral-800 bg-neutral-950/50 hover:border-amber-400/50'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-amber-400 mb-1" />
                    <span className="text-[11px] font-semibold text-neutral-200">
                      Upload Image {slot.slotNumber}
                    </span>
                    <span className="text-[9px] font-mono text-neutral-400 mt-0.5">
                      Auto: 100%→{defaultPeak}%
                    </span>
                  </div>
                )}

                {/* Slot Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      slotInputRefs[idx].current?.click();
                    }}
                    className="flex-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] font-semibold cursor-pointer transition-colors truncate"
                  >
                    {slot.url ? 'Replace' : 'Choose File'}
                  </button>

                  {slot.url && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSequenceSlot(idx, true);
                          onNext();
                        }}
                        className="py-1 px-2 rounded bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                        title="Edit zoom & keyframes"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateSequenceSlot(idx, { visible: !slot.visible });
                        }}
                        className={`p-1 rounded cursor-pointer ${
                          slot.visible
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-neutral-800 text-neutral-500'
                        }`}
                        title={slot.visible ? 'Visible' : 'Hidden'}
                      >
                        {slot.visible ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isProcessing && (
        <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2">
          Validating and decoding media for preview and video export...
        </div>
      )}

      {/* Uploaded Media Library */}
      {mediaList.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Uploaded Files ({mediaList.length})</span>
            </h4>
            <span className="text-[11px] text-neutral-400">
              Assign any file to Background or Image 1 / 2 / 3
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {mediaList.map((item) => {
              const isBg = item.url === currentMediaUrl;
              const assignedSlots = imageSequence
                .filter((s) => s.url === item.url)
                .map((s) => `Img ${s.slotNumber}`);

              return (
                <div
                  key={item.id}
                  className={`relative aspect-4/3 rounded-lg overflow-hidden border-2 group transition-all ${
                    assignedSlots.length > 0
                      ? 'border-amber-400'
                      : isBg
                      ? 'border-rose-500'
                      : 'border-neutral-800'
                  }`}
                >
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleRemoveLibraryItem(item.id, e)}
                    title="Delete file"
                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/75 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1 z-10">
                    {isBg && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        Bg
                      </span>
                    )}
                    {assignedSlots.map((label) => (
                      <span
                        key={label}
                        className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[9px] font-bold"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent grid grid-cols-4 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                    <button
                      type="button"
                      onClick={() => onSelectMedia(item.url, item.name, item.type)}
                      className="py-1 rounded text-[9px] font-semibold bg-neutral-800 hover:bg-rose-600 text-neutral-100 cursor-pointer"
                    >
                      Bg
                    </button>
                    {([0, 1, 2] as const).map((slotIdx) => (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() =>
                          onAssignSequenceSlot(slotIdx, item.url, item.name, item.type)
                        }
                        className="py-1 rounded text-[9px] font-semibold bg-neutral-800 hover:bg-amber-400 hover:text-black text-neutral-100 cursor-pointer"
                      >
                        Img {slotIdx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Continue CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-950"
        >
          <span>Continue to Sequence, Keyframes & Background Fit</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
};
