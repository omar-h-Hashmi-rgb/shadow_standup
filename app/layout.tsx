import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Shadow Standup",
  description: "Automated developer documentation agent.",
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
        <Toaster position="top-right" richColors expand={true} />
      </body>
    </html>
  );
}
