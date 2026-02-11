"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "synesthesia:user-id";

function generateId() {
  return `user_${Math.random().toString(36).slice(2, 10)}`;
}

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
      setUserId(existing);
      return;
    }

    const next = generateId();
    window.sessionStorage.setItem(STORAGE_KEY, next);
    setUserId(next);
  }, []);

  return userId;
}
