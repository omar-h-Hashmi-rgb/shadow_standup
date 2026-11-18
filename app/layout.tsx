import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
<<<<<<< HEAD
import PostLoginRedirect from "@/components/PostLoginRedirect";
=======
>>>>>>> origin/main
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Shadow Standup",
<<<<<<< HEAD
  description: "Standups and code reviews generated from your GitHub activity.",
=======
  description: "Automated developer documentation agent.",
>>>>>>> origin/main
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
<<<<<<< HEAD
        <PostLoginRedirect />
        <Toaster position="top-right" richColors />
=======
        <Toaster position="top-right" richColors expand={true} />
>>>>>>> origin/main
      </body>
    </html>
  );
}
