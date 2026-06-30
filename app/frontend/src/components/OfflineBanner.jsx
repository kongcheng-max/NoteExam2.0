import React, { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [showInstall, setShowInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Listen for beforeinstallprompt
    const handleInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handleInstall);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstallDismissed(true);
    }

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstall(false);
    if (outcome === "accepted") {
      setInstallDismissed(true);
    }
  };

  if (offline && !dismissed) {
    return (
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 500, background: "#FEF2F2", color: "#991B1B",
        padding: "10px 20px", borderRadius: 8, fontSize: ".82rem",
        boxShadow: "0 2px 12px rgba(0,0,0,.1)", display: "flex",
        alignItems: "center", gap: 12, maxWidth: "90%",
      }}>
        <span>⚠ 当前处于离线状态，部分功能不可用</span>
        <button onClick={() => setDismissed(true)} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#991B1B", fontWeight: 600, fontSize: ".82rem",
        }}>✕</button>
      </div>
    );
  }

  if (showInstall && !installDismissed) {
    return (
      <div style={{
        position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
        zIndex: 500, background: "#EEF2FF", color: "#3730A3",
        padding: "12px 20px", borderRadius: 8, fontSize: ".82rem",
        boxShadow: "0 2px 12px rgba(0,0,0,.1)", display: "flex",
        alignItems: "center", gap: 12, maxWidth: "90%",
      }}>
        <span>📲 安装 NoteExam 到桌面，离线也能用</span>
        <button onClick={handleInstall} style={{
          background: "#4F46E5", color: "#fff", border: "none",
          borderRadius: 6, padding: "6px 14px", cursor: "pointer",
          fontWeight: 500, fontSize: ".8rem",
        }}>安装</button>
        <button onClick={() => { setShowInstall(false); setInstallDismissed(true); }} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#6B7280", fontSize: ".82rem",
        }}>✕</button>
      </div>
    );
  }

  return null;
}
