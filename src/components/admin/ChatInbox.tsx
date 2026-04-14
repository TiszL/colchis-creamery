'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, User, Clock, XCircle, Send, ChevronLeft, Wifi, WifiOff } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SessionPreview {
    id: string;
    visitorName: string;
    visitorEmail: string | null;
    status: string;
    assignedTo: { id: string; name: string } | null;
    lastMessage: { body: string; sender: string; createdAt: string } | null;
    messageCount: number;
    lastMessageAt: string;
    createdAt: string;
}

interface FullMessage {
    id: string;
    body: string;
    sender: 'visitor' | 'agent' | 'system';
    createdAt: string;
}

interface FullSession {
    id: string;
    visitorName: string | null;
    visitorEmail: string | null;
    status: string;
    assignedTo: { id: string; name: string } | null;
    messages: FullMessage[];
    createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function fmt(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

// ══════════════════════════════════════════════════════════════════════════════

export default function ChatInbox() {
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const [waitingCount, setWaitingCount] = useState(0);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [activeSession, setActiveSession] = useState<FullSession | null>(null);
    const [replyInput, setReplyInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sseConnected, setSseConnected] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const replyInputRef = useRef<HTMLInputElement>(null);
    const sseRef = useRef<EventSource | null>(null);
    const prevWaiting = useRef(0);
    const knownMsgIds = useRef<Set<string>>(new Set());

    // ── Scroll to bottom ─────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeSession?.messages]);

    useEffect(() => {
        if (activeSessionId && replyInputRef.current) replyInputRef.current.focus();
    }, [activeSessionId]);

    // ── Fetch sessions list ──────────────────────────────────────────────────
    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch('/api/chat/staff');
            const data = await res.json();
            if (data.sessions) {
                setSessions(data.sessions);
                setWaitingCount(data.waitingCount || 0);

                // Audio chime on new waiting session
                if (data.waitingCount > prevWaiting.current && prevWaiting.current >= 0) {
                    playChime();
                }
                prevWaiting.current = data.waitingCount;
            }
        } catch { /* network error */ }
    }, []);

    // ── Fetch active conversation ────────────────────────────────────────────
    const fetchActiveSession = useCallback(async () => {
        if (!activeSessionId) return;
        try {
            const res = await fetch(`/api/chat/staff/${activeSessionId}`);
            const data = await res.json();
            if (data.session) setActiveSession(data.session);
        } catch { /* network error */ }
    }, [activeSessionId]);

    // ── SSE Connection ───────────────────────────────────────────────────────
    useEffect(() => {
        // Initial fetch
        fetchSessions();

        const es = new EventSource('/api/chat/staff/stream');
        sseRef.current = es;

        es.onopen = () => setSseConnected(true);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'sessions_update') {
                    // Refetch session list
                    fetchSessions();
                }

                if (data.type === 'new_message' && data.message) {
                    // Synchronous dedup via ref
                    if (knownMsgIds.current.has(data.message.id)) return;
                    knownMsgIds.current.add(data.message.id);

                    // If this message belongs to active session, update in place
                    setActiveSession(prev => {
                        if (!prev || prev.id !== data.message.sessionId) return prev;
                        // Remove any optimistic version with same body
                        const filtered = prev.messages.filter(m => !m.id.startsWith('opt-') || m.body !== data.message.body);
                        if (filtered.some(m => m.id === data.message.id)) return { ...prev, messages: filtered };
                        return { ...prev, messages: [...filtered, data.message] };
                    });
                }
            } catch { /* parse error */ }
        };

        es.onerror = () => {
            setSseConnected(false);
            // EventSource auto-reconnects
        };

        return () => {
            es.close();
            setSseConnected(false);
        };
    }, [fetchSessions]);

    // Fetch active session when selected
    useEffect(() => {
        if (activeSessionId) {
            fetchActiveSession();
        } else {
            setActiveSession(null);
        }
    }, [activeSessionId, fetchActiveSession]);

    // ── Claim session ────────────────────────────────────────────────────────
    const claimSession = async (sessionId: string) => {
        try {
            await fetch(`/api/chat/staff/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'claim' }),
            });
            setActiveSessionId(sessionId);
            fetchSessions();
            fetchActiveSession();
        } catch (err) {
            console.error('Failed to claim:', err);
        }
    };

    // ── Close session ────────────────────────────────────────────────────────
    const closeSession = async () => {
        if (!activeSessionId) return;
        try {
            await fetch(`/api/chat/staff/${activeSessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'close' }),
            });
            setActiveSessionId(null);
            setActiveSession(null);
            fetchSessions();
        } catch (err) {
            console.error('Failed to close:', err);
        }
    };

    // ── Send reply ───────────────────────────────────────────────────────────
    const sendReply = async () => {
        if (!replyInput.trim() || !activeSessionId || isSending) return;
        const body = replyInput.trim();
        setReplyInput('');
        setIsSending(true);

        // Optimistic add
        const optId = `opt-${Date.now()}`;
        const optimistic: FullMessage = {
            id: optId,
            body,
            sender: 'agent',
            createdAt: new Date().toISOString(),
        };
        setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev);

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: activeSessionId,
                    sender: 'agent',
                    body,
                }),
            });
            const data = await res.json();
            if (data.message) {
                knownMsgIds.current.add(data.message.id);
                setActiveSession(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        messages: prev.messages.map(m => m.id === optId ? data.message : m),
                    };
                });
            }
        } catch {
            // Keep optimistic message
        } finally {
            setIsSending(false);
        }
    };

    // ── Audio chime ──────────────────────────────────────────────────────────
    function playChime() {
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            osc.type = 'sine';
            gain.gain.value = 0.08;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.35);
        } catch { /* audio not available */ }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <div className="flex h-[calc(100vh-8rem)] bg-[#0D0D0D] rounded-xl border border-white/5 overflow-hidden">

            {/* ── Left Panel: Session List ────────────────────────────── */}
            <div className={`${activeSessionId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 border-r border-white/5`}>
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-white font-bold text-lg">Live Chat</h2>
                            {waitingCount > 0 && (
                                <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                    {waitingCount} waiting
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5" title={sseConnected ? 'Real-time connected' : 'Reconnecting...'}>
                            {sseConnected ? (
                                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                                <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Session List */}
                <div className="flex-1 overflow-y-auto">
                    {sessions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <MessageCircle className="w-8 h-8 text-gray-700" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium mb-1">No active conversations</p>
                            <p className="text-gray-700 text-xs">New chats will appear here instantly</p>
                        </div>
                    ) : (
                        sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => {
                                    if (s.status === 'WAITING') claimSession(s.id);
                                    else setActiveSessionId(s.id);
                                }}
                                className={`w-full text-left px-5 py-4 border-b border-white/5 hover:bg-white/5 transition ${
                                    activeSessionId === s.id ? 'bg-white/5 border-l-2 border-l-[#CBA153]' : ''
                                }`}
                            >
                                <div className="flex items-start justify-between mb-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                            s.status === 'WAITING'
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                        }`}>
                                            {s.visitorName.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-medium leading-tight truncate">{s.visitorName}</p>
                                            {s.visitorEmail && (
                                                <p className="text-gray-600 text-[10px] truncate">{s.visitorEmail}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                        <span className="text-gray-600 text-[10px]">{timeAgo(s.lastMessageAt)}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                            s.status === 'WAITING'
                                                ? 'bg-amber-500/10 text-amber-400'
                                                : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                            {s.status === 'WAITING' ? 'New' : 'Active'}
                                        </span>
                                    </div>
                                </div>
                                {s.lastMessage && (
                                    <p className="text-gray-500 text-xs line-clamp-1 ml-[42px]">
                                        {s.lastMessage.sender === 'agent' ? 'You: ' : ''}
                                        {s.lastMessage.body}
                                    </p>
                                )}
                                {s.status === 'WAITING' && (
                                    <p className="text-amber-400 text-[10px] mt-1.5 ml-[42px] font-medium">
                                        Click to claim & respond →
                                    </p>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── Right Panel: Active Conversation ────────────────────── */}
            <div className={`${activeSessionId ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
                {activeSession ? (
                    <>
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={() => setActiveSessionId(null)} className="md:hidden text-gray-400 hover:text-white p-1 -ml-1 transition">
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="w-8 h-8 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center">
                                    <User className="w-4 h-4 text-[#CBA153]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-semibold truncate">{activeSession.visitorName || 'Anonymous'}</p>
                                    <p className="text-gray-600 text-[10px] truncate">{activeSession.visitorEmail || 'No contact info'}</p>
                                </div>
                            </div>
                            {activeSession.status !== 'CLOSED' && (
                                <button onClick={closeSession}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition border border-red-500/20 shrink-0">
                                    <XCircle className="w-3.5 h-3.5" />
                                    Close
                                </button>
                            )}
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-2.5">
                            {activeSession.messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.sender === 'agent' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                                    {msg.sender === 'system' ? (
                                        <span className="text-[10px] text-gray-600 bg-white/5 px-3 py-1 rounded-full max-w-[90%] text-center">
                                            {msg.body}
                                        </span>
                                    ) : (
                                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                            msg.sender === 'agent'
                                                ? 'bg-[#CBA153] text-black rounded-br-sm'
                                                : 'bg-white/5 text-gray-300 rounded-bl-sm border border-white/5'
                                        }`}>
                                            {msg.sender === 'visitor' && (
                                                <p className="text-[10px] text-gray-500 font-semibold mb-0.5">Visitor</p>
                                            )}
                                            <p className="whitespace-pre-wrap">{msg.body}</p>
                                            <p className={`text-[10px] mt-1 ${msg.sender === 'agent' ? 'text-black/40' : 'text-gray-600'}`}>
                                                {fmt(msg.createdAt)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply Input */}
                        {activeSession.status !== 'CLOSED' ? (
                            <div className="p-4 border-t border-white/5 shrink-0">
                                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10 focus-within:border-[#CBA153]/30 transition">
                                    <input
                                        ref={replyInputRef}
                                        type="text"
                                        value={replyInput}
                                        onChange={e => setReplyInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && sendReply()}
                                        placeholder="Type your reply..."
                                        className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
                                    />
                                    <button onClick={sendReply} disabled={!replyInput.trim() || isSending}
                                        className="text-[#CBA153] hover:text-white p-1 transition disabled:text-gray-700 disabled:cursor-not-allowed">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 border-t border-white/5 text-center">
                                <span className="text-gray-600 text-xs">Conversation closed</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
                            <MessageCircle className="w-10 h-10 text-gray-800" />
                        </div>
                        <h3 className="text-gray-400 font-semibold mb-2">Select a conversation</h3>
                        <p className="text-gray-700 text-sm max-w-xs">
                            Choose a chat from the sidebar or wait for new incoming conversations.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
