import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cordova Fit Hub",
  description: "Gym membership and operations portal",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
