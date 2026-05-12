'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
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
            .catch(() => setChatStatus({ isOnline: false, schedule: 'Mon–Fri 9AM–6PM EST', offlineEmail: 'hello@colchisfood.com' }));
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
                    if (knownMsgIds.current.has(data.message.id)) return;
                    knownMsgIds.current.add(data.message.id);

                    setMessages(prev => {
                        const filtered = prev.filter(m => !m.id.startsWith('opt-') || m.body !== data.message.body);
                        if (filtered.some(m => m.id === data.message.id)) return filtered;
                        return [...filtered, data.message];
                    });

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
        };

        return es;
    }, []);

    useEffect(() => {
        if (sessionId && sessionStatus !== 'CLOSED') {
            const es = connectSSE(sessionId);
            return () => { es.close(); setSseConnected(false); };
        }
    }, [sessionId, sessionStatus, connectSSE]);

    // ── Create session (auth user) ───────────────────────────────────────────
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

    // ── Create session (anonymous) ───────────────────────────────────────────
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
        } catch {
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
                knownMsgIds.current.add(data.message.id);
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

    // ── Styles ───────────────────────────────────────────────────────────────
    const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0.24em", textTransform: "uppercase" };
    const serif: React.CSSProperties = { fontFamily: "var(--font-serif)" };
    const sans: React.CSSProperties = { fontFamily: "var(--font-sans)" };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "12px 14px",
        background: "#F5F0E6", border: "1px solid #1F302633",
        color: "#1F3026", ...sans, fontSize: 13, outline: "none",
    };

    // ══════════════════════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════════════════════

    return (
        <>
            {/* ── Chat Window ──────────────────────────────────────── */}
            {isOpen && !isMinimized && (
                <div style={{
                    position: "fixed", bottom: 88, right: 24,
                    width: 380, maxHeight: 560,
                    background: "#F5F0E6", border: "1px solid #1F302622",
                    boxShadow: "0 20px 60px rgba(31,48,38,0.18)",
                    zIndex: 9999, display: "flex", flexDirection: "column",
                    overflow: "hidden",
                }} className="ch-chat-window">

                    {/* Header */}
                    <div style={{
                        background: "#1F3026", color: "#F5F0E6",
                        padding: "18px 22px", flexShrink: 0,
                        borderBottom: "1px solid #F5F0E61A",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div>
                                <div style={{ ...mono, fontSize: 9, color: "#D9A876" }}>
                                    № 00 — The Counter
                                </div>
                                <div style={{ ...serif, fontStyle: "italic", fontSize: 24, fontWeight: 300, marginTop: 4, color: "#F5F0E6" }}>
                                    Live support
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setIsMinimized(true)} aria-label="Minimize" style={{ width: 30, height: 30, background: "transparent", border: "1px solid #F5F0E633", color: "#F5F0E6", cursor: "pointer", fontSize: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                                <button onClick={() => setIsOpen(false)} aria-label="Close" style={{ width: 30, height: 30, background: "transparent", border: "1px solid #F5F0E633", color: "#F5F0E6", cursor: "pointer", fontSize: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, ...mono, fontSize: 9 }}>
                            {sessionId && sseConnected ? (
                                <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#B96A3D", display: "inline-block" }} /><span style={{ color: "#D9A876" }}>Connected</span></>
                            ) : sessionId ? (
                                <><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#D9A876", display: "inline-block", animation: "pulse 1.5s infinite" }} /><span style={{ color: "#D9A876" }}>Reconnecting...</span></>
                            ) : (
                                <><span style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "#B96A3D" : "#7A8278", display: "inline-block" }} /><span style={{ color: isOnline ? "#D9A876" : "#7A8278" }}>{isOnline ? "Online · Tue–Sat" : "Offline"}</span></>
                            )}
                        </div>
                    </div>

                    {/* Offline Banner */}
                    {!isOnline && (
                        <div style={{ padding: "12px 22px", background: "#EAE2D2", borderBottom: "1px solid #1F302614", flexShrink: 0 }}>
                            <div style={{ ...mono, fontSize: 9, color: "#B96A3D" }}>Currently offline</div>
                            <div style={{ ...sans, fontSize: 12.5, color: "#2C3D33", marginTop: 4 }}>
                                Hours: {chatStatus?.schedule}
                            </div>
                            <a href={`mailto:${chatStatus?.offlineEmail}`} style={{ ...mono, fontSize: 9, color: "#B96A3D", marginTop: 6, display: "inline-block" }}>
                                {chatStatus?.offlineEmail} →
                            </a>
                        </div>
                    )}

                    {/* ── State: INFO (visitor form) ──────────────────── */}
                    {widgetState === 'info' && (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
                            <div style={{ width: "100%", maxWidth: 340 }}>
                                <div style={{ textAlign: "center", marginBottom: 24 }}>
                                    <div style={{ ...mono, fontSize: 9, color: "#B96A3D", marginBottom: 6 }}>Before we begin</div>
                                    <div style={{ ...serif, fontStyle: "italic", fontSize: 22, color: "#1F3026", fontWeight: 300 }}>A few details, please.</div>
                                    <div style={{ ...sans, fontSize: 12.5, color: "#7A8278", marginTop: 6 }}>We&apos;ll use these to follow up if we miss you.</div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div>
                                        <label style={{ display: "block", ...mono, fontSize: 8, color: "#7A8278", marginBottom: 6 }}>Name *</label>
                                        <input
                                            type="text" value={vName} onChange={e => setVName(e.target.value)}
                                            placeholder="Nino Beridze" autoFocus style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", ...mono, fontSize: 8, color: "#7A8278", marginBottom: 6 }}>Email *</label>
                                        <input
                                            type="email" value={vEmail} onChange={e => setVEmail(e.target.value)}
                                            placeholder="you@colchisfood.com" style={inputStyle}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", ...mono, fontSize: 8, color: "#7A8278", marginBottom: 6 }}>Phone (optional)</label>
                                        <input
                                            type="tel" value={vPhone} onChange={e => setVPhone(e.target.value)}
                                            placeholder="+1 (614) 555 0142" style={inputStyle}
                                        />
                                    </div>
                                </div>

                                {formError && (
                                    <div style={{ marginTop: 10, padding: 10, background: "#A8312C11", color: "#A8312C", fontSize: 12, border: "1px solid #A8312C33", ...sans }}>
                                        {formError}
                                    </div>
                                )}

                                <button
                                    onClick={startVisitorSession}
                                    disabled={isConnecting}
                                    style={{
                                        width: "100%", marginTop: 18, background: "#1F3026", color: "#F5F0E6",
                                        border: "none", padding: "14px 0",
                                        ...mono, fontSize: 10,
                                        cursor: "pointer", opacity: isConnecting ? 0.7 : 1,
                                    }}
                                >
                                    {isConnecting ? 'Connecting...' : 'Start the chat →'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── State: CHATTING ──────────────────────────────── */}
                    {widgetState === 'chatting' && (
                        <>
                            {/* Messages */}
                            <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 8px" }}>
                                {messages.map(msg => (
                                    <div key={msg.id} style={{
                                        display: "flex",
                                        justifyContent: msg.sender === 'visitor' ? 'flex-end' : msg.sender === 'system' ? 'center' : 'flex-start',
                                        marginBottom: 10,
                                    }}>
                                        {msg.sender === 'system' ? (
                                            <span style={{ ...mono, fontSize: 8, color: "#7A8278", background: "#EAE2D2", padding: "5px 12px", border: "1px solid #1F302614" }}>
                                                {msg.body}
                                            </span>
                                        ) : (
                                            <div style={{
                                                maxWidth: "82%",
                                                padding: "12px 16px",
                                                ...sans, fontSize: 13.5, lineHeight: 1.55,
                                                ...(msg.sender === 'visitor'
                                                    ? { background: "#1F3026", color: "#F5F0E6" }
                                                    : { background: "#fff", color: "#1F3026", border: "1px solid #1F302622" }
                                                ),
                                            }}>
                                                {msg.sender === 'agent' && (
                                                    <div style={{ ...mono, fontSize: 8, color: "#B96A3D", marginBottom: 4 }}>Colchis Support</div>
                                                )}
                                                <div style={{ whiteSpace: "pre-wrap" }}>{msg.body}</div>
                                                <div style={{
                                                    ...mono, fontSize: 8, marginTop: 6, letterSpacing: "0.16em",
                                                    color: msg.sender === 'visitor' ? "#F5F0E688" : "#7A8278",
                                                }}>
                                                    {fmt(msg.createdAt)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {isClosed && (
                                    <div style={{ textAlign: "center", padding: "8px 0" }}>
                                        <span style={{ ...mono, fontSize: 8, color: "#7A8278", background: "#EAE2D2", padding: "5px 12px", border: "1px solid #1F302614" }}>
                                            Chat ended
                                        </span>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Quick Replies */}
                            {!isClosed && messages.filter(m => m.sender === 'visitor').length === 0 && (
                                <div style={{ padding: "0 18px 8px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0 }}>
                                    {QUICK_REPLIES.map(q => (
                                        <button key={q} onClick={() => sendMessage(q)} style={{
                                            padding: "7px 12px",
                                            ...mono, fontSize: 9, letterSpacing: "0.2em",
                                            background: "transparent", color: "#1F3026",
                                            border: "1px solid #1F302633", cursor: "pointer",
                                        }}>
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Input */}
                            {!isClosed ? (
                                <div style={{ padding: "14px 18px", borderTop: "1px solid #1F302614", flexShrink: 0, background: "#EAE2D2" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F5F0E6", border: "1px solid #1F302633", padding: "10px 14px" }}>
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputValue}
                                            onChange={e => setInputValue(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={isOnline ? 'Type a note...' : 'Leave a message...'}
                                            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#1F3026", ...sans, fontSize: 13 }}
                                        />
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!inputValue.trim()}
                                            aria-label="Send"
                                            style={{ background: "transparent", border: "none", cursor: inputValue.trim() ? "pointer" : "default", color: inputValue.trim() ? "#B96A3D" : "#7A8278", padding: 4 }}
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                                        </button>
                                    </div>
                                    <div style={{ ...mono, fontSize: 8, color: "#7A8278", marginTop: 8, textAlign: "center" }}>
                                        Secure · TLS 1.3
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: "14px 18px", borderTop: "1px solid #1F302614", flexShrink: 0 }}>
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
                                        style={{
                                            width: "100%", padding: "14px 0",
                                            background: "#1F3026", color: "#F5F0E6",
                                            border: "none", ...mono, fontSize: 10,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Start new conversation →
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── State: IDLE/Loading ──────────────────────────── */}
                    {widgetState === 'idle' && isConnecting && (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                            <div style={{ textAlign: "center" }}>
                                <div style={{ width: 28, height: 28, margin: "0 auto 12px", border: "2px solid #B96A3D", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                                <div style={{ ...mono, fontSize: 9, color: "#7A8278" }}>Connecting...</div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Floating Button ──────────────────────────────────── */}
            <button
                onClick={isOpen && isMinimized ? handleOpen : isOpen ? () => setIsOpen(false) : handleOpen}
                aria-label="Live chat support"
                style={{
                    position: "fixed", bottom: 24, right: 24,
                    width: 52, height: 52,
                    background: "#1F3026", border: "1px solid #F5F0E622",
                    borderRadius: "50%",
                    boxShadow: "0 6px 24px rgba(31,48,38,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", zIndex: 9999,
                    transition: "transform 0.2s, box-shadow 0.2s",
                }}
                className="ch-chat-fab"
            >
                {isOpen && !isMinimized ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5F0E6" strokeWidth={1.6}><path d="M18 6L6 18M6 6l12 12" /></svg>
                ) : (
                    <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5F0E6" strokeWidth={1.4}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                        {unread > 0 && (
                            <span style={{
                                position: "absolute", top: -3, right: -3,
                                width: 18, height: 18, borderRadius: "50%",
                                background: "#B96A3D", color: "#F5F0E6",
                                fontSize: 10, fontWeight: 700,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>{unread}</span>
                        )}
                    </>
                )}
            </button>
        </>
    );
}
