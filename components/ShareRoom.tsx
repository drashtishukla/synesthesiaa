"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Props = {
  roomCode: string;
};

export default function ShareRoom({ roomCode }: Props) {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomCode}`
      : `/room/${roomCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="h-7 px-3 text-[11px] font-medium bg-accent text-white hover:brightness-110 border border-accent transition-all duration-200"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={() => setShowQR((v) => !v)}
        className="h-7 px-3 text-[11px] font-medium bg-accent text-white hover:brightness-110 border border-accent transition-all duration-200"
      >
        {showQR ? "Hide QR" : "QR Code"}
      </button>

      {showQR ? (
        <div className="mt-2 w-full flex justify-center">
          <div className="bg-white p-3 shadow-lg shadow-primary/15">
            <QRCodeSVG value={url} size={160} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
