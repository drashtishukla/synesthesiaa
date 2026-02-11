"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

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
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopy}
        type="button"
        className="h-7 text-xs"
      >
        {copied ? "Copied!" : "Copy link"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setShowQR((v) => !v)}
        type="button"
        className="h-7 text-xs"
      >
        {showQR ? "Hide QR" : "QR Code"}
      </Button>

      {showQR ? (
        <div className="mt-2 w-full flex justify-center">
          <div className="rounded-2xl bg-white p-3">
            <QRCodeSVG value={url} size={160} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
