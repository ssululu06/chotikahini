"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthModal } from "@/components/auth/AuthModal";

interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  profilePic?: string;
  savedPosts?: string[];
  createdAt?: string;
  role?: "user" | "author" | "admin" | "superadmin" | "content_manager" | "moderator";
  isVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {},
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      refreshSession, 
      logout,
      openAuthModal: () => setIsModalOpen(true),
      closeAuthModal: () => setIsModalOpen(false)
    }}>
      {children}
      <AuthModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
