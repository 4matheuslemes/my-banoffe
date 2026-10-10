import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banoffe Bot — Assistente Inteligente",
  description: "Chatbot no Telegram com IA para controle de pedidos e vendas de banoffe no pote.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
