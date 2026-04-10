'use client';

import { useState, useCallback, useRef } from 'react';
import {
    Type, Heading2, Heading3, ImageIcon, Film, List, ListOrdered,
    Quote, Minus, Plus, GripVertical, Trash2, ChevronUp, ChevronDown,
    Eye, Pencil, Upload
} from 'lucide-react';
import MediaUploadZone from './MediaUploadZone';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ContentBlock {
    id: string;
    type: 'paragraph' | 'heading' | 'image' | 'video' | 'list' | 'quote' | 'divider';
    data: Record<string, any>;
}

interface ContentBlockEditorProps {
    initialBlocks?: ContentBlock[];
    onChange: (blocks: ContentBlock[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
    return Math.random().toString(36).substr(2, 9);
}

function createBlock(type: ContentBlock['type']): ContentBlock {
    switch (type) {
        case 'paragraph':
            return { id: genId(), type, data: { text: '' } };
        case 'heading':
            return { id: genId(), type, data: { text: '', level: 2 } };
        case 'image':
            return { id: genId(), type, data: { url: '', caption: '', alt: '' } };
        case 'video':
            return { id: genId(), type, data: { url: '', caption: '' } };
        case 'list':
            return { id: genId(), type, data: { style: 'unordered', items: [''] } };
        case 'quote':
            return { id: genId(), type, data: { text: '', attribution: '' } };
        case 'divider':
            return { id: genId(), type, data: {} };
    }
}

const BLOCK_TYPES: { type: ContentBlock['type']; label: string; icon: any }[] = [
    { type: 'paragraph', label: 'Paragraph', icon: Type },
    { type: 'heading', label: 'Heading', icon: Heading2 },
    { type: 'image', label: 'Image', icon: ImageIcon },
    { type: 'video', label: 'Video / YouTube', icon: Film },
    { type: 'list', label: 'List', icon: List },
    { type: 'quote', label: 'Quote', icon: Quote },
    { type: 'divider', label: 'Divider', icon: Minus },
];

// ─── Block Editor Component ──────────────────────────────────────────────────

function BlockEditor({
    block,
    onUpdate,
    onDelete,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}: {
    block: ContentBlock;
    onUpdate: (data: Record<string, any>) => void;
    onDelete: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const inputClass = "w-full bg-[#0D0D0D] border border-white/10 text-white py-2.5 px-4 rounded-lg focus:outline-none focus:border-[#CBA153] placeholder-gray-700 text-sm";

    const renderBlock = () => {
        switch (block.type) {
            case 'paragraph':
                return (
                    <textarea
                        value={block.data.text || ''}
                        onChange={(e) => onUpdate({ text: e.target.value })}
                        placeholder="Write your paragraph here... Use **bold**, *italic*, [link](url)"
                        rows={3}
                        className={`${inputClass} resize-y font-light leading-relaxed`}
                    />
                );

            case 'heading': {
                const level = block.data.level || 2;
                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...block.data, level: 2 })}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${level === 2 ? 'bg-[#CBA153] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                H2
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...block.data, level: 3 })}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${level === 3 ? 'bg-[#CBA153] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                H3
                            </button>
                        </div>
                        <input
                            value={block.data.text || ''}
                            onChange={(e) => onUpdate({ ...block.data, text: e.target.value })}
                            placeholder="Section heading..."
                            className={`${inputClass} ${level === 2 ? 'text-xl font-serif' : 'text-lg font-serif'}`}
                        />
                    </div>
                );
            }

            case 'image':
                return (
                    <div className="space-y-3">
                        <MediaUploadZone
                            value={block.data.url ? [block.data.url] : []}
                            onChange={(urls) => onUpdate({ ...block.data, url: urls[0] || '' })}
                            type="image"
                            label="Block Image"
                            multiple={false}
                            maxFiles={1}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                value={block.data.caption || ''}
                                onChange={(e) => onUpdate({ ...block.data, caption: e.target.value })}
                                placeholder="Caption (optional)"
                                className={inputClass}
                            />
                            <input
                                value={block.data.alt || ''}
                                onChange={(e) => onUpdate({ ...block.data, alt: e.target.value })}
                                placeholder="Alt text for SEO"
                                className={inputClass}
                            />
                        </div>
                    </div>
                );

            case 'video':
                return (
                    <div className="space-y-3">
                        <input
                            value={block.data.url || ''}
                            onChange={(e) => onUpdate({ ...block.data, url: e.target.value })}
                            placeholder="YouTube URL or video file URL..."
                            className={inputClass}
                        />
                        {block.data.url && getYouTubeId(block.data.url) && (
                            <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                                <iframe
                                    src={`https://www.youtube.com/embed/${getYouTubeId(block.data.url)}`}
                                    className="absolute inset-0 w-full h-full"
                                    allowFullScreen
                                />
                            </div>
                        )}
                        <input
                            value={block.data.caption || ''}
                            onChange={(e) => onUpdate({ ...block.data, caption: e.target.value })}
                            placeholder="Video caption (optional)"
                            className={inputClass}
                        />
                    </div>
                );

            case 'list': {
                const items: string[] = block.data.items || [''];
                const style = block.data.style || 'unordered';
                return (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...block.data, style: 'unordered' })}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${style === 'unordered' ? 'bg-[#CBA153] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                <List className="w-3 h-3" /> Bullet
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...block.data, style: 'ordered' })}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition-all ${style === 'ordered' ? 'bg-[#CBA153] text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            >
                                <ListOrdered className="w-3 h-3" /> Numbered
                            </button>
                        </div>
                        <div className="space-y-2">
                            {items.map((item: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600 w-5 text-right font-mono">
                                        {style === 'ordered' ? `${idx + 1}.` : '•'}
                                    </span>
                                    <input
                                        value={item}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            newItems[idx] = e.target.value;
                                            onUpdate({ ...block.data, items: newItems });
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const newItems = [...items];
                                                newItems.splice(idx + 1, 0, '');
                                                onUpdate({ ...block.data, items: newItems });
                                            }
                                            if (e.key === 'Backspace' && item === '' && items.length > 1) {
                                                e.preventDefault();
                                                onUpdate({ ...block.data, items: items.filter((_: string, i: number) => i !== idx) });
                                            }
                                        }}
                                        placeholder="List item..."
                                        className={`flex-1 ${inputClass}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onUpdate({ ...block.data, items: items.filter((_: string, i: number) => i !== idx) })}
                                        className="text-red-400/40 hover:text-red-400 transition-colors p-1"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => onUpdate({ ...block.data, items: [...items, ''] })}
                            className="flex items-center gap-1 text-xs text-[#CBA153] hover:text-white transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Add item
                        </button>
                    </div>
                );
            }

            case 'quote':
                return (
                    <div className="space-y-3 border-l-3 border-[#CBA153]/30 pl-4">
                        <textarea
                            value={block.data.text || ''}
                            onChange={(e) => onUpdate({ ...block.data, text: e.target.value })}
                            placeholder="Quote text..."
                            rows={2}
                            className={`${inputClass} resize-y italic font-serif`}
                        />
                        <input
                            value={block.data.attribution || ''}
                            onChange={(e) => onUpdate({ ...block.data, attribution: e.target.value })}
                            placeholder="Attribution (optional) — e.g., Grandmother's wisdom"
                            className={inputClass}
                        />
                    </div>
                );

            case 'divider':
                return (
                    <div className="flex items-center justify-center gap-3 py-2">
                        <span className="w-12 h-px bg-[#CBA153]/30" />
                        <span className="w-2 h-2 rounded-full bg-[#CBA153]/20" />
                        <span className="w-12 h-px bg-[#CBA153]/30" />
                    </div>
                );
        }
    };

    // Block type icon
    const TypeIcon = BLOCK_TYPES.find(t => t.type === block.type)?.icon || Type;

    return (
        <div className="group relative bg-[#1A1A1A] rounded-xl border border-white/5 hover:border-[#CBA153]/20 transition-all overflow-hidden">
            {/* Block header */}
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/5 flex items-center justify-between bg-[#141414]">
                <div className="flex items-center gap-2">
                    <GripVertical className="w-3.5 h-3.5 text-gray-700 cursor-grab hidden sm:block" />
                    <TypeIcon className="w-3.5 h-3.5 text-[#CBA153]/60" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                        {BLOCK_TYPES.find(t => t.type === block.type)?.label}
                    </span>
                </div>
                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={onMoveUp} disabled={isFirst}
                        className="p-1.5 sm:p-1 text-gray-600 hover:text-white disabled:opacity-20 transition-colors">
                        <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={onMoveDown} disabled={isLast}
                        className="p-1.5 sm:p-1 text-gray-600 hover:text-white disabled:opacity-20 transition-colors">
                        <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-3 bg-white/10 mx-0.5 sm:mx-1" />
                    <button type="button" onClick={onDelete}
                        className="p-1.5 sm:p-1 text-red-400/40 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Block content */}
            <div className="p-3 sm:p-4">
                {renderBlock()}
            </div>
        </div>
    );
}

// YouTube helper
function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function ContentBlockEditor({ initialBlocks = [], onChange }: ContentBlockEditorProps) {
    const [blocks, setBlocks] = useState<ContentBlock[]>(
        initialBlocks.length > 0 ? initialBlocks : [createBlock('paragraph')]
    );
    const [showAddMenu, setShowAddMenu] = useState<number | null>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);

    const updateBlocks = useCallback((newBlocks: ContentBlock[]) => {
        setBlocks(newBlocks);
        onChange(newBlocks);
    }, [onChange]);

    const addBlock = useCallback((type: ContentBlock['type'], afterIndex: number) => {
        const newBlock = createBlock(type);
        const newBlocks = [...blocks];
        newBlocks.splice(afterIndex + 1, 0, newBlock);
        updateBlocks(newBlocks);
        setShowAddMenu(null);
    }, [blocks, updateBlocks]);

    const updateBlock = useCallback((index: number, data: Record<string, any>) => {
        const newBlocks = [...blocks];
        newBlocks[index] = { ...newBlocks[index], data };
        updateBlocks(newBlocks);
    }, [blocks, updateBlocks]);

    const deleteBlock = useCallback((index: number) => {
        if (blocks.length <= 1) return; // Keep at least one block
        const newBlocks = blocks.filter((_, i) => i !== index);
        updateBlocks(newBlocks);
    }, [blocks, updateBlocks]);

    const moveBlock = useCallback((from: number, to: number) => {
        if (to < 0 || to >= blocks.length) return;
        const newBlocks = [...blocks];
        const [moved] = newBlocks.splice(from, 1);
        newBlocks.splice(to, 0, moved);
        updateBlocks(newBlocks);
    }, [blocks, updateBlocks]);

    // Word count
    const wordCount = blocks.reduce((acc, block) => {
        const text = block.data.text || '';
        const items = (block.data.items || []).join(' ');
        return acc + (text + ' ' + items).trim().split(/\s+/).filter(Boolean).length;
    }, 0);

    return (
        <div className="space-y-3">
            {/* Blocks */}
            {blocks.map((block, index) => (
                <div key={block.id}>
                    <BlockEditor
                        block={block}
                        onUpdate={(data) => updateBlock(index, data)}
                        onDelete={() => deleteBlock(index)}
                        onMoveUp={() => moveBlock(index, index - 1)}
                        onMoveDown={() => moveBlock(index, index + 1)}
                        isFirst={index === 0}
                        isLast={index === blocks.length - 1}
                    />

                    {/* Add block button (between blocks) */}
                    <div className="relative flex items-center justify-center py-1.5">
                        <button
                            type="button"
                            onClick={() => setShowAddMenu(showAddMenu === index ? null : index)}
                            className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-white/10 hover:border-[#CBA153]/40 flex items-center justify-center text-gray-600 hover:text-[#CBA153] transition-all hover:scale-110"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Block type picker */}
                        {showAddMenu === index && (
                            <div
                                ref={addMenuRef}
                                className="absolute z-50 top-full mt-1 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl py-2 min-w-[200px]"
                            >
                                {BLOCK_TYPES.map((bt) => (
                                    <button
                                        key={bt.type}
                                        type="button"
                                        onClick={() => addBlock(bt.type, index)}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-[#CBA153]/10 transition-all"
                                    >
                                        <bt.icon className="w-4 h-4 text-[#CBA153]/60" />
                                        {bt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Footer stats */}
            <div className="flex items-center justify-between px-2 py-2 text-[10px] text-gray-600 uppercase tracking-widest">
                <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
                <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
            </div>
        </div>
    );
}
