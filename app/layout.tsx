import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import PostLoginRedirect from "@/components/PostLoginRedirect";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Shadow Standup",
  description: "Standups and code reviews generated from your GitHub activity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Navbar />
          <main className="app-content">{children}</main>
        </div>
        <PostLoginRedirect />
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
