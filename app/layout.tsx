import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ethiopian Languages Data factory",
  description: "Collect, transcribe, translate, and review Ethiopian language audio data with consent and quality controls."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}