"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "synesthesia:user-id";
const NAME_STORAGE_KEY = "synesthesia:user-name";

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

export function useUserName() {
  const [userName, setUserNameState] = useState<string | null>(null);

  useEffect(() => {
    const existing = window.localStorage.getItem(NAME_STORAGE_KEY);
    if (existing) {
      setUserNameState(existing);
    }
  }, []);

  const setUserName = (name: string) => {
    window.localStorage.setItem(NAME_STORAGE_KEY, name);
    setUserNameState(name);
  };

  return [userName, setUserName] as const;
}
