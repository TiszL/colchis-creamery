'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Minimize2, Clock, Mail, Wifi, WifiOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMsg {
    id: string;
    body: string;
    sender: 'visitor' | 'agent' | 'system';
    createdAt: string;
}

interface ChatStatus {
    isOnline: boolean;
    schedule: string;
    offlineEmail: string;
}

type WidgetState = 'idle' | 'info' | 'chatting';

// ── Storage helpers ──────────────────────────────────────────────────────────

function getVisitorId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('cc_vid');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('cc_vid', id);
    }
    return id;
}

function getStoredSession(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('cc_sid');
}

function setStoredSession(id: string | null) {
    if (typeof window === 'undefined') return;
    if (id) localStorage.setItem('cc_sid', id);
    else localStorage.removeItem('cc_sid');
}

function fmt(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

// ══════════════════════════════════════════════════════════════════════════════

export default function LiveChatWidget() {
    const { user, isLoggedIn, isLoading: authLoading } = useAuth();

    // UI
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [unread, setUnread] = useState(0);

    // Chat
    const [widgetState, setWidgetState] = useState<WidgetState>('idle');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMsg[]>([]);
    const [sessionStatus, setSessionStatus] = useState<string>('WAITING');
    const [inputValue, setInputValue] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [sseConnected, setSseConnected] = useState(false);

    // Visitor info form
    const [vName, setVName] = useState('');
    const [vEmail, setVEmail] = useState('');
    const [vPhone, setVPhone] = useState('');
    const [formError, setFormError] = useState('');

    // Online status
    const [chatStatus, setChatStatus] = useState<ChatStatus | null>(null);

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sseRef = useRef<EventSource | null>(null);
    const knownMsgIds = useRef<Set<string>>(new Set());

    // Quick replies
    const QUICK_REPLIES = ['Product info', 'Order status', 'Wholesale', 'Shipping', 'Other'];

    // ── Scroll to bottom ─────────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) inputRef.current.focus();
    }, [isOpen, isMinimized, widgetState]);

    // ── Fetch online status ──────────────────────────────────────────────────
    useEffect(() => {
        fetch('/api/chat/status')
            .then(r => r.json())
            .then(setChatStatus)
            .catch(() => setChatStatus({ isOnline: false, schedule: 'Mon–Fri 9AM–6PM EST', offlineEmail: 'sales@colchiscreamery.com' }));
    }, []);

    // ── Resume existing session on mount ─────────────────────────────────────
    useEffect(() => {
        if (authLoading) return;

        const tryResume = async () => {
            try {
                const url = isLoggedIn
                    ? '/api/chat/session'
                    : `/api/chat/session?visitorId=${getVisitorId()}`;
                const res = await fetch(url, { credentials: 'include' });
                const data = await res.json();
                if (data.session) {
                    setSessionId(data.session.id);
                    setStoredSession(data.session.id);
                    setMessages(data.session.messages || []);
                    setSessionStatus(data.session.status || 'WAITING');
                    setWidgetState('chatting');
                }
            } catch { /* no existing session */ }
        };

        const stored = getStoredSession();
        if (stored || isLoggedIn) {
            tryResume();
        }
    }, [isLoggedIn, authLoading]);

    // ── SSE Connection ───────────────────────────────────────────────────────
    const connectSSE = useCallback((sid: string) => {
        // Close existing
        if (sseRef.current) {
            sseRef.current.close();
            sseRef.current = null;
        }

        const es = new EventSource(`/api/chat/stream?sessionId=${sid}`);
        sseRef.current = es;

        es.onopen = () => setSseConnected(true);

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'message' && data.message) {
                    // Synchronous dedup via ref (avoids React batching race)
                    if (knownMsgIds.current.has(data.message.id)) return;
                    knownMsgIds.current.add(data.message.id);

                    setMessages(prev => {
                        // Also remove any optimistic version of this message
                        const filtered = prev.filter(m => !m.id.startsWith('opt-') || m.body !== data.message.body);
                        if (filtered.some(m => m.id === data.message.id)) return filtered;
                        return [...filtered, data.message];
                    });

                    // Count unread from non-visitor messages
                    if (data.message.sender !== 'visitor') {
                        setUnread(u => u + 1);
                    }
                }

                if (data.type === 'status') {
                    setSessionStatus(data.status);
                    if (data.status === 'CLOSED') {
                        setStoredSession(null);
                    }
                }
            } catch { /* parse error */ }
        };

        es.onerror = () => {
            setSseConnected(false);
            // EventSource auto-reconnects
        };

        return es;
    }, []);

    // Start SSE when sessionId is set
    useEffect(() => {
        if (sessionId && sessionStatus !== 'CLOSED') {
            const es = connectSSE(sessionId);
            return () => { es.close(); setSseConnected(false); };
        }
    }, [sessionId, sessionStatus, connectSSE]);

    // ── Create session (auth user — instant) ─────────────────────────────────
    const startAuthSession = async () => {
        setIsConnecting(true);
        try {
            const res = await fetch('/api/chat/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({}),
            });
            const data = await res.json();
            if (data.session) {
                setSessionId(data.session.id);
                setStoredSession(data.session.id);
                setMessages(data.session.messages || []);
                setWidgetState('chatting');
            }
        } catch (err) {
            console.error('Failed to start session:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    // ── Create session (anonymous visitor) ───────────────────────────────────
    const startVisitorSession = async () => {
        setFormError('');
        if (!vName.trim()) { setFormError('Name is required'); return; }
        if (!vEmail.trim() && !vPhone.trim()) { setFormError('Email or phone is required'); return; }

        setIsConnecting(true);
        try {
            const res = await fetch('/api/chat/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visitorId: getVisitorId(),
                    visitorName: vName.trim(),
                    visitorEmail: vEmail.trim() || undefined,
                    visitorPhone: vPhone.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.error) {
                setFormError(data.error);
            } else if (data.session) {
                setSessionId(data.session.id);
                setStoredSession(data.session.id);
                setMessages(data.session.messages || []);
                setWidgetState('chatting');
            }
        } catch (err) {
            setFormError('Connection failed. Please try again.');
        } finally {
            setIsConnecting(false);
        }
    };

    // ── Send message ─────────────────────────────────────────────────────────
    const sendMessage = async (text?: string) => {
        const body = text || inputValue.trim();
        if (!body || !sessionId) return;
        setInputValue('');

        // Optimistic add
        const optId = `opt-${Date.now()}`;
        const optimistic: ChatMsg = {
            id: optId,
            body,
            sender: 'visitor',
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimistic]);

        try {
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, sender: 'visitor', body }),
            });
            const data = await res.json();
            if (data.message) {
                // Mark real ID as known so SSE won't duplicate it
                knownMsgIds.current.add(data.message.id);
                // Replace optimistic with real
                setMessages(prev =>
                    prev.map(m => m.id === optId ? data.message : m)
                );
            }
        } catch {
            // Keep optimistic message visible
        }
    };

    // ── Open handler ─────────────────────────────────────────────────────────
    const handleOpen = () => {
        setIsOpen(true);
        setIsMinimized(false);
        setUnread(0);

        if (widgetState === 'idle' && !sessionId) {
            if (isLoggedIn) {
                // Auto-create session for auth users
                startAuthSession();
            } else {
                setWidgetState('info');
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const isOnline = chatStatus?.isOnline ?? true;
    const isClosed = sessionStatus === 'CLOSED';

    // ══════════════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <>
            {/* ── Chat Window ──────────────────────────────────────── */}
            {isOpen && !isMinimized && (
                <div className="fixed inset-0 md:inset-auto md:bottom-20 md:right-6 md:w-[400px] md:max-h-[600px] md:rounded-2xl bg-[#111] md:shadow-2xl md:shadow-black/50 md:border md:border-white/10 overflow-hidden z-[9999] flex flex-col">

                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#1A1A1A] to-[#0D0D0D] px-4 py-3 flex items-center justify-between border-b border-white/5 shrink-0 safe-area-top">
                        <div className="flex items-center gap-3">
                            {/* Back button on mobile */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="md:hidden text-gray-400 hover:text-white p-1 -ml-1 transition"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-[#CBA153]" />
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold">Colchis Support</p>
                                <div className="flex items-center gap-1.5">
                                    {sessionId && sseConnected ? (
                                        <>
                                            <Wifi className="w-3 h-3 text-emerald-400" />
                                            <span className="text-[10px] text-emerald-400">Connected</span>
                                        </>
                                    ) : sessionId ? (
                                        <>
                                            <WifiOff className="w-3 h-3 text-amber-400" />
                                            <span className="text-[10px] text-amber-400">Reconnecting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                                            <span className={`text-[10px] ${isOnline ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setIsMinimized(true)} className="hidden md:block text-gray-500 hover:text-white p-1.5 transition">
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsOpen(false)} className="hidden md:block text-gray-500 hover:text-white p-1.5 transition">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Offline Banner */}
                    {!isOnline && (
                        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 shrink-0">
                            <div className="flex items-start gap-2 text-amber-400 text-xs">
                                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium">We&apos;re currently offline</p>
                                    <p className="text-amber-400/70 mt-0.5">Hours: {chatStatus?.schedule}</p>
                                    <a href={`mailto:${chatStatus?.offlineEmail}`} className="flex items-center gap-1 text-[#CBA153] mt-1 hover:underline">
                                        <Mail className="w-3 h-3" />{chatStatus?.offlineEmail}
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── State: INFO (visitor form) ──────────────────── */}
                    {widgetState === 'info' && (
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="w-full max-w-sm space-y-5">
                                <div className="text-center">
                                    <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/20 flex items-center justify-center">
                                        <MessageCircle className="w-7 h-7 text-[#CBA153]" />
                                    </div>
                                    <h3 className="text-white font-semibold text-lg mb-1">Chat with us</h3>
                                    <p className="text-gray-500 text-xs">We&apos;ll need a few details to get started</p>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        value={vName}
                                        onChange={e => setVName(e.target.value)}
                                        placeholder="Your name *"
                                        className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 placeholder:text-gray-600 focus:outline-none focus:border-[#CBA153]/40 transition"
                                        autoFocus
                                    />
                                    <input
                                        type="email"
                                        value={vEmail}
                                        onChange={e => setVEmail(e.target.value)}
                                        placeholder="Email *"
                                        className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 placeholder:text-gray-600 focus:outline-none focus:border-[#CBA153]/40 transition"
                                    />
                                    <input
                                        type="tel"
                                        value={vPhone}
                                        onChange={e => setVPhone(e.target.value)}
                                        placeholder="Phone (optional)"
                                        className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-xl px-4 py-3 placeholder:text-gray-600 focus:outline-none focus:border-[#CBA153]/40 transition"
                                    />
                                </div>

                                {formError && (
                                    <p className="text-red-400 text-xs text-center">{formError}</p>
                                )}

                                <button
                                    onClick={startVisitorSession}
                                    disabled={isConnecting}
                                    className="w-full bg-[#CBA153] text-black font-semibold py-3 rounded-xl hover:bg-white transition-colors disabled:opacity-50 text-sm"
                                >
                                    {isConnecting ? 'Connecting...' : 'Start Chat'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── State: CHATTING ──────────────────────────────── */}
                    {widgetState === 'chatting' && (
                        <>
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.sender === 'visitor' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                                        {msg.sender === 'system' ? (
                                            <span className="text-[10px] text-gray-600 bg-white/5 px-3 py-1 rounded-full max-w-[90%] text-center">
                                                {msg.body}
                                            </span>
                                        ) : (
                                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                                msg.sender === 'visitor'
                                                    ? 'bg-[#CBA153] text-black rounded-br-sm'
                                                    : 'bg-white/5 text-gray-300 rounded-bl-sm border border-white/5'
                                            }`}>
                                                {msg.sender === 'agent' && (
                                                    <p className="text-[10px] text-[#CBA153] font-semibold mb-0.5">Colchis Support</p>
                                                )}
                                                <p className="whitespace-pre-wrap">{msg.body}</p>
                                                <p className={`text-[10px] mt-1 ${msg.sender === 'visitor' ? 'text-black/40' : 'text-gray-600'}`}>
                                                    {fmt(msg.createdAt)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isClosed && (
                                    <div className="text-center pt-2">
                                        <span className="text-[10px] text-gray-600 bg-white/5 px-3 py-1.5 rounded-full">
                                            Chat ended
                                        </span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Quick Replies (when no messages sent yet) */}
                            {!isClosed && messages.filter(m => m.sender === 'visitor').length === 0 && (
                                <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                                    {QUICK_REPLIES.map(q => (
                                        <button key={q} onClick={() => sendMessage(q)}
                                            className="px-3 py-1.5 text-xs bg-white/5 text-gray-400 border border-white/10 rounded-full hover:bg-[#CBA153]/10 hover:text-[#CBA153] hover:border-[#CBA153]/20 transition-all">
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input or closed state */}
                            {!isClosed ? (
                                <div className="p-3 border-t border-white/5 shrink-0 safe-area-bottom">
                                    <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-[#CBA153]/30 transition">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={isOnline ? 'Type a message...' : 'Leave a message...'}
                                            className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!inputValue.trim()}
                                            className="text-[#CBA153] hover:text-white p-1 transition disabled:text-gray-700 disabled:cursor-not-allowed"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 border-t border-white/5 shrink-0 safe-area-bottom">
                                    <button
                                        onClick={() => {
                                            setSessionId(null);
                                            setStoredSession(null);
                                            setMessages([]);
                                            setSessionStatus('WAITING');
                                            setSseConnected(false);
                                            if (isLoggedIn) {
                                                startAuthSession();
                                            } else {
                                                setWidgetState('info');
                                            }
                                        }}
                                        className="w-full py-3 bg-white/5 text-white text-sm rounded-xl hover:bg-[#CBA153]/10 hover:text-[#CBA153] transition border border-white/10"
                                    >
                                        Start New Conversation
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── State: IDLE/Loading ──────────────────────────── */}
                    {widgetState === 'idle' && isConnecting && (
                        <div className="flex-1 flex items-center justify-center p-8">
                            <div className="text-center">
                                <div className="w-8 h-8 mx-auto mb-3 border-2 border-[#CBA153] border-t-transparent rounded-full animate-spin" />
                                <p className="text-gray-500 text-sm">Connecting...</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Floating Button ──────────────────────────────────── */}
            <button
                onClick={isOpen && isMinimized ? handleOpen : isOpen ? () => setIsOpen(false) : handleOpen}
                className="fixed bottom-4 right-4 md:right-6 w-14 h-14 bg-[#CBA153] rounded-full shadow-lg shadow-[#CBA153]/20 flex items-center justify-center z-[9999] hover:bg-white hover:shadow-white/20 transition-all duration-300 group safe-area-bottom"
                aria-label="Live chat support"
            >
                {isOpen && !isMinimized ? (
                    <X className="w-6 h-6 text-black" />
                ) : (
                    <>
                        <MessageCircle className="w-6 h-6 text-black" />
                        {unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                                {unread}
                            </span>
                        )}
                    </>
                )}
            </button>
        </>
    );
}
