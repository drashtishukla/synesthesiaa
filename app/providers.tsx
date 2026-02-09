"use client";

import * as React from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
let convex: ConvexReactClient | null = null;

function getConvexClient() {
  if (!convexUrl) {
    return null;
  }

  if (!convex) {
    convex = new ConvexReactClient(convexUrl);
  }

  return convex;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = getConvexClient();

  if (!client) {
    return <>{children}</>;
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
