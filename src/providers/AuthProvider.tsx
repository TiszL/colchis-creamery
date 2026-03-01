"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthUser {
    userId: string;
    name: string;
    email: string;
    role: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
    logout: async () => { },
    refresh: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const logout = useCallback(async () => {
        try {
            // Call the logout server action via a form POST
            const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            if (res.ok) {
                setUser(null);
                window.location.href = "/";
            }
        } catch {
            // Fallback: just redirect
            window.location.href = "/";
        }
    }, []);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        await fetchUser();
    }, [fetchUser]);

    return (
        <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, logout, refresh }}>
            {children}
        </AuthContext.Provider>
    );
}
