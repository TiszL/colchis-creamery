"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { Product, CartItem } from "@/types";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = "colchis-cart";
// Cross-tab cart sync. Mirrors AddressManager's pattern (handoff §3.4) so a
// clear-on-success in one tab also drops the cart counter in any other open tab.
const CART_BROADCAST_NAME = "colchis-cart-sync";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage might be full or unavailable
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Refs for the cross-tab sync. The listener is created once on mount; without
  // these refs it would close over stale items and re-broadcast in a ping-pong
  // loop with the sender tab.
  const channelRef = useRef<BroadcastChannel | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const skipBroadcastRef = useRef(false);

  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    setItems(loadCart());
    setIsLoaded(true);
  }, []);

  // Set up the broadcast listener once. Compares incoming items to current —
  // identical messages are ignored (avoids redundant re-renders and the
  // ping-pong scenario where two tabs trade the same items forever). When a
  // genuinely-new state arrives, we set a one-shot flag so the items-effect
  // below knows NOT to re-broadcast what it just received.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(CART_BROADCAST_NAME);
    channelRef.current = ch;
    ch.onmessage = (e) => {
      if (e.data?.type !== "cart-sync" || !Array.isArray(e.data.items)) return;
      const next: CartItem[] = e.data.items;
      if (JSON.stringify(next) === JSON.stringify(itemsRef.current)) return;
      skipBroadcastRef.current = true;
      setItems(next);
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  // Persist locally on every change. Broadcast to other tabs UNLESS this
  // change was itself the result of a sync (in which case re-broadcasting
  // would loop). Skip both until the initial localStorage load completes so
  // we don't blow away saved items with an empty initial state.
  useEffect(() => {
    if (!isLoaded) return;
    saveCart(items);
    if (skipBroadcastRef.current) {
      skipBroadcastRef.current = false;
      return;
    }
    channelRef.current?.postMessage({ type: "cart-sync", items });
  }, [items, isLoaded]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.product.priceB2c * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
