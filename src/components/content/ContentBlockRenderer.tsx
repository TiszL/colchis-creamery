'use client';

/**
 * ContentBlockRenderer — renders JSON content blocks on the frontend.
 * Used by both /journal/[slug] and /recipes/[slug] pages.
 * 
 * Supports: paragraph, heading, image, video, list, quote, divider
 * Falls back to legacy plain-text rendering if no blocks are provided.
 */

interface ContentBlock {
    type: 'paragraph' | 'heading' | 'image' | 'video' | 'list' | 'quote' | 'divider';
    data: Record<string, any>;
}

interface ContentBlockRendererProps {
    blocks?: string | null; // JSON string of ContentBlock[]
    legacyContent?: string; // Plain text/markdown fallback
}

// Extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// Render inline formatting: **bold**, *italic*, [links](url)
function renderInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    // Process bold, italic, and links
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        if (match[2]) {
            // Bold
            parts.push(<strong key={key++} className="font-semibold text-[#2C2A29]">{match[2]}</strong>);
        } else if (match[3]) {
            // Italic
            parts.push(<em key={key++} className="italic">{match[3]}</em>);
        } else if (match[4] && match[5]) {
            // Link
            parts.push(
                <a key={key++} href={match[5]} className="text-[#8A6A28] underline hover:text-[#6B5320] transition-colors" target="_blank" rel="noopener noreferrer">
                    {match[4]}
                </a>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
}

function BlockRenderer({ block }: { block: ContentBlock }) {
    switch (block.type) {
        case 'paragraph':
            return (
                <p className="text-[#2C2A29]/80 leading-relaxed mb-6 text-lg">
                    {renderInline(block.data.text || '')}
                </p>
            );

        case 'heading': {
            const level = block.data.level || 2;
            const id = (block.data.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            if (level === 2) {
                return <h2 id={id} className="text-2xl md:text-3xl font-serif text-[#CBA153] mb-4 mt-10 scroll-mt-24">{block.data.text}</h2>;
            }
            return <h3 id={id} className="text-xl md:text-2xl font-serif text-[#2C2A29] mb-4 mt-8 scroll-mt-24">{block.data.text}</h3>;
        }

        case 'image':
            return (
                <figure className="my-8">
                    <div className="rounded-lg overflow-hidden border border-[#FDFBF7] shadow-sm">
                        <img
                            src={block.data.url}
                            alt={block.data.alt || block.data.caption || ''}
                            className="w-full h-auto"
                            loading="lazy"
                        />
                    </div>
                    {block.data.caption && (
                        <figcaption className="mt-3 text-center text-sm text-[#2C2A29]/50 italic">
                            {block.data.caption}
                        </figcaption>
                    )}
                </figure>
            );

        case 'video': {
            const ytId = block.data.url ? getYouTubeId(block.data.url) : null;
            return (
                <figure className="my-8">
                    {ytId ? (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-sm border border-[#FDFBF7]">
                            <iframe
                                src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                                title={block.data.caption || 'Video'}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="absolute inset-0 w-full h-full"
                            />
                        </div>
                    ) : block.data.url ? (
                        <video
                            src={block.data.url}
                            controls
                            className="w-full rounded-lg shadow-sm border border-[#FDFBF7]"
                        />
                    ) : null}
                    {block.data.caption && (
                        <figcaption className="mt-3 text-center text-sm text-[#2C2A29]/50 italic">
                            {block.data.caption}
                        </figcaption>
                    )}
                </figure>
            );
        }

        case 'list': {
            const isOrdered = block.data.style === 'ordered';
            const items: string[] = block.data.items || [];
            const Tag = isOrdered ? 'ol' : 'ul';
            return (
                <Tag className={`mb-6 ml-4 space-y-2 ${isOrdered ? 'list-decimal' : ''}`}>
                    {items.map((item, j) => (
                        <li key={j} className={`flex items-start text-[#2C2A29]/80 leading-relaxed text-lg ${isOrdered ? 'list-item ml-5' : ''}`}>
                            {!isOrdered && (
                                <span className="inline-block w-2 h-2 rounded-full bg-[#CBA153] mt-2.5 mr-3 flex-shrink-0" />
                            )}
                            <span>{renderInline(item)}</span>
                        </li>
                    ))}
                </Tag>
            );
        }

        case 'quote':
            return (
                <blockquote className="my-8 border-l-4 border-[#CBA153] pl-6 py-2">
                    <p className="text-xl text-[#2C2A29]/80 leading-relaxed font-serif italic">
                        {block.data.text}
                    </p>
                    {block.data.attribution && (
                        <cite className="block mt-3 text-sm text-[#2C2A29]/50 not-italic">
                            — {block.data.attribution}
                        </cite>
                    )}
                </blockquote>
            );

        case 'divider':
            return (
                <div className="my-10 flex items-center justify-center gap-3">
                    <span className="w-8 h-px bg-[#CBA153]/30" />
                    <span className="w-2 h-2 rounded-full bg-[#CBA153]/30" />
                    <span className="w-8 h-px bg-[#CBA153]/30" />
                </div>
            );

        default:
            return null;
    }
}

// Legacy markdown renderer (for content without blocks)
function LegacyRenderer({ content }: { content: string }) {
    return (
        <>
            {content.split('\n\n').map((block, i) => {
                const trimmed = block.trim();
                if (!trimmed) return null;

                if (trimmed.startsWith('### ')) {
                    return <h3 key={i} className="text-xl font-serif text-[#2C2A29] mb-4 mt-8">{trimmed.replace('### ', '')}</h3>;
                }
                if (trimmed.startsWith('## ')) {
                    return <h2 key={i} className="text-2xl font-serif text-[#CBA153] mb-4 mt-10">{trimmed.replace('## ', '')}</h2>;
                }
                if (trimmed.startsWith('# ')) {
                    return <h2 key={i} className="text-3xl font-serif text-[#2C2A29] mb-6 mt-10">{trimmed.replace('# ', '')}</h2>;
                }

                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                    const items = trimmed.split('\n').filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
                    return (
                        <ul key={i} className="space-y-2 mb-6 ml-4">
                            {items.map((item, j) => (
                                <li key={j} className="flex items-start text-[#2C2A29]/80 leading-relaxed">
                                    <span className="inline-block w-2 h-2 rounded-full bg-[#CBA153] mt-2 mr-3 flex-shrink-0" />
                                    <span>{item.replace(/^[-*]\s*/, '')}</span>
                                </li>
                            ))}
                        </ul>
                    );
                }

                return (
                    <p key={i} className="text-[#2C2A29]/80 leading-relaxed mb-6 text-lg">
                        {renderInline(trimmed)}
                    </p>
                );
            })}
        </>
    );
}

export default function ContentBlockRenderer({ blocks, legacyContent }: ContentBlockRendererProps) {
    // Try to parse JSON blocks first
    if (blocks) {
        try {
            const parsed: ContentBlock[] = JSON.parse(blocks);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return (
                    <div className="prose-colchis">
                        {parsed.map((block, i) => (
                            <BlockRenderer key={i} block={block} />
                        ))}
                    </div>
                );
            }
        } catch {
            // Fall through to legacy
        }
    }

    // Fallback to legacy plain text/markdown
    if (legacyContent) {
        return (
            <div className="prose-colchis">
                <LegacyRenderer content={legacyContent} />
            </div>
        );
    }

    return null;
}
