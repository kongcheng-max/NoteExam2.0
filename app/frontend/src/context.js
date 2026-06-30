import React, { createContext, useContext } from 'react';

export const ToastContext = createContext(null);
export const AuthContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function useAuth() {
  return useContext(AuthContext);
}
