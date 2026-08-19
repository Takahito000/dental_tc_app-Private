import "./globals.css";

export const metadata = {
  title: "AI自費義歯カウンセリング支援",
  description: "Dental Treatment Coordinator Suite",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-100 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}