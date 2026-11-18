import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Care — Đồng hành cùng con",
  description: "Không gian quản lý thiết bị và đồng hành cùng trẻ dành cho gia đình.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'Family Care',statusBarStyle:'default'},
  icons: {
    apple: '/icon-192.png',
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
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
