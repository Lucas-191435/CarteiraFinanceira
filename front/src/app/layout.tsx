import type { Metadata } from "next";
import { Archivo_Black, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});



//teste
export const metadata: Metadata = {
  title: {
    default: "Bolt — Carteira digital",
    template: "%s — Bolt",
  },
  description: "Deposite, envie e receba dinheiro com a carteira Bolt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
