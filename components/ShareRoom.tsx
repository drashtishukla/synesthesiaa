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
        className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:brightness-110 border border-primary transition-all duration-200"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={() => setShowQR((v) => !v)}
        className="h-7 px-3 rounded-lg text-[11px] font-medium bg-white/[0.06] text-white/60 hover:bg-primary/20 hover:text-primary border border-white/[0.08] hover:border-primary/30 transition-all duration-200"
      >
        {showQR ? "Hide QR" : "QR Code"}
      </button>

      {showQR ? (
        <div className="mt-2 w-full flex justify-center">
          <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/[0.08] p-4 shadow-lg shadow-primary/10">
            <QRCodeSVG
              value={url}
              size={160}
              bgColor="transparent"
              fgColor="hsl(24, 100%, 50%)"
              level="M"
              imageSettings={{
                src: "",
                height: 0,
                width: 0,
                excavate: false,
              }}
            />
            <p className="text-center text-[10px] text-white/25 mt-2 font-mono tracking-wider">
              {roomCode}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
