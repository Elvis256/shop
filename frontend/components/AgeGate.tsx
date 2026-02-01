"use client";

import { useState, useEffect } from "react";
import { ShieldCheck } from "lucide-react";

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const verified = localStorage.getItem("age-verified");
    if (!verified) {
      setShow(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem("age-verified", "true");
    setShow(false);
  };

  const handleDeny = () => {
    window.location.href = "https://google.com";
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
      <div className="bg-white rounded-8 p-8 max-w-md w-full text-center">
        <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-accent" />
        <h2 className="mb-4">Age Verification Required</h2>
        <p className="text-text-muted mb-8">
          This website contains adult content and is intended for individuals 18 years
          of age or older. By entering, you confirm that you are of legal age.
        </p>
        <div className="space-y-4">
          <button onClick={handleConfirm} className="btn-primary w-full">
            I am 18 or older — Enter
          </button>
          <button onClick={handleDeny} className="btn-secondary w-full">
            I am under 18 — Exit
          </button>
        </div>
        <p className="text-small text-text-muted mt-6">
          Your privacy is important to us. We use discreet packaging and billing.
        </p>
      </div>
    </div>
  );
}
