import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Paint Together – Collaborative Drawing Online",
  description: "On this website you can paint together with others. Share a collaborative drawing canvas in real time—draw, use stamps, and create art with friends.",
  keywords: ["paint together", "collaborative drawing", "draw online", "shared canvas", "paint with others"],
  openGraph: {
    title: "Paint Together – Collaborative Drawing Online",
    description: "On this website you can paint together with others. Share a collaborative drawing canvas in real time.",
    type: "website",
  },
  icons: {
    icon: "/favicon/favicon.ico",
    shortcut: "/favicon/favicon.ico",
    apple: "/favicon/apple-touch-icon.png",
  },
  manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
