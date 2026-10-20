import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "飞跃日程规划本",
  description: "春日里的年、月、周规划，收集灵感，自由安排。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
