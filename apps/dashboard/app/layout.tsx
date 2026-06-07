import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DingMap Sync",
  description: "钉图自动化同步工作台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
