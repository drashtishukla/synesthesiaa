import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Synesthesia Widget",
  description: "Embeddable music queue widget powered by Synesthesia.",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-auto">
      {children}
    </div>
  );
}
