import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Care — Quản lý trẻ em",
  description: "Quản lý trẻ em dành cho phụ huynh, giáo viên và bảo mẫu theo quyền được cấp.",
  manifest: '/manifest.webmanifest',
  appleWebApp: {capable:true,title:'Family Care',statusBarStyle:'default'},
  other: {'apple-mobile-web-app-capable':'yes'},
  icons: {
    apple: '/icon-192.png',
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#527c61'};

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
