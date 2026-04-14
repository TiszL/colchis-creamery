'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Minimize2 } from 'lucide-react';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'system';
    time: string;
}

const QUICK_REPLIES = [
    'Product information',
    'Order status',
    'Wholesale inquiry',
    'Shipping & returns',
    'Other question',
];

const AUTO_RESPONSES: Record<string, string> = {
    'product information': "We'd love to help! You can browse our full range at the Shop page, or tell us which product you're interested in and we'll provide details.",
    'order status': "To check your order status, please log into your account and visit the Orders section. If you need further help, leave your order number here and our team will follow up via email.",
    'wholesale inquiry': "Thank you for your interest in wholesale! Please visit our Wholesale page to submit a partnership application, or leave your company details here and our Sales team will reach out.",
    'shipping & returns': "We offer nationwide shipping. Standard delivery is 3-5 business days. For returns, please contact us within 14 days of delivery. Full details are on our Terms page.",
    'other question': "Please describe your question and our team will respond as soon as possible. You can also reach us at hello@colchiscreamery.com.",
};

export default function LiveChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '0',
            text: "Welcome to Colchis Creamery! 🧀 How can we help you today?",
            sender: 'system',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [showQuickReplies, setShowQuickReplies] = useState(true);
    const [unread, setUnread] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const addMessage = (text: string, sender: 'user' | 'system') => {
        const msg: ChatMessage = {
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            text,
            sender,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, msg]);
        return msg;
    };

    const handleSend = (text?: string) => {
        const msg = text || inputValue.trim();
        if (!msg) return;

        addMessage(msg, 'user');
        setInputValue('');
        setShowQuickReplies(false);

        // Auto-response with slight delay
        setTimeout(() => {
            const lower = msg.toLowerCase();
            const matchedKey = Object.keys(AUTO_RESPONSES).find(k => lower.includes(k));
            const response = matchedKey
                ? AUTO_RESPONSES[matchedKey]
                : "Thank you for your message! Our team will review it and get back to you shortly. For urgent inquiries, email us at hello@colchiscreamery.com.";
            addMessage(response, 'system');

            if (!isOpen) {
                setUnread(prev => prev + 1);
            }
        }, 800);
    };

    const handleOpen = () => {
        setIsOpen(true);
        setIsMinimized(false);
        setUnread(0);
    };

    return (
        <>
            {/* Chat Window */}
            {isOpen && !isMinimized && (
                <div
                    className="fixed bottom-20 right-4 md:right-6 w-[calc(100vw-2rem)] max-w-[380px] bg-[#141414] rounded-2xl shadow-2xl shadow-black/40 border border-white/10 overflow-hidden z-[9999] flex flex-col"
                    style={{ maxHeight: 'min(520px, calc(100vh - 120px))' }}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#1A1A1A] to-[#111] px-4 py-3 flex items-center justify-between border-b border-white/5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[#CBA153]/10 border border-[#CBA153]/30 flex items-center justify-center">
                                <MessageCircle className="w-4 h-4 text-[#CBA153]" />
                            </div>
                            <div>
                                <p className="text-white text-sm font-semibold">Colchis Support</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] text-emerald-400">Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsMinimized(true)}
                                className="text-gray-500 hover:text-white p-1.5 transition-colors"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-500 hover:text-white p-1.5 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '200px' }}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                        msg.sender === 'user'
                                            ? 'bg-[#CBA153] text-black rounded-br-sm'
                                            : 'bg-white/5 text-gray-300 rounded-bl-sm border border-white/5'
                                    }`}
                                >
                                    <p>{msg.text}</p>
                                    <p className={`text-[10px] mt-1 ${msg.sender === 'user' ? 'text-black/40' : 'text-gray-600'}`}>
                                        {msg.time}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Replies */}
                    {showQuickReplies && (
                        <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
                            {QUICK_REPLIES.map((reply) => (
                                <button
                                    key={reply}
                                    onClick={() => handleSend(reply)}
                                    className="px-3 py-1.5 text-xs bg-white/5 text-gray-400 border border-white/10 rounded-full hover:bg-[#CBA153]/10 hover:text-[#CBA153] hover:border-[#CBA153]/20 transition-all"
                                >
                                    {reply}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-white/5 shrink-0">
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/10 focus-within:border-[#CBA153]/30 transition-colors">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Type a message..."
                                className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-600 focus:outline-none"
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!inputValue.trim()}
                                className="text-[#CBA153] hover:text-white p-1 transition-colors disabled:text-gray-700 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={isOpen && isMinimized ? handleOpen : isOpen ? () => setIsOpen(false) : handleOpen}
                className="fixed bottom-4 right-4 md:right-6 w-14 h-14 bg-[#CBA153] rounded-full shadow-lg shadow-[#CBA153]/20 flex items-center justify-center z-[9999] hover:bg-white hover:shadow-white/20 transition-all duration-300 group"
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
