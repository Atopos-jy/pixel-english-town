import type { Metadata } from "next";
import 'bytemd/dist/index.css';
import './bytemd-custom.css';
import './globals.css';
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "每日英语阅读 (Daily English Reader)",
  description: "A daily English reading application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="font-sans bg-slate-50">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
