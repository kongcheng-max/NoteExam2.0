import React, { useState, useCallback, useRef, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Home from './pages/Home';
import Toast from './components/Toast';

export const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export default function App() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const timerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    setToast({ show: true, message, type });
    timerRef.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      <BrowserRouter>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </BrowserRouter>
    </ToastContext.Provider>
  );
}
