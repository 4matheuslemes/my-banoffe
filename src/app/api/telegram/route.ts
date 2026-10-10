import { supabase } from "@/lib/supabase";
import { sendMessage, sendTyping } from "@/lib/telegram";
import { runAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowed = (process.env.ALLOWED_TELEGRAM_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function GET() {
  return Response.json({
    status: "online",
    bot: "Banoffe Bot",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: Request) {
  if (
    req.headers.get("x-telegram-bot-api-secret-token") !==
    process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    return new Response("forbidden", { status: 403 });
  }

  const update = await req.json();
  const msg = update.message;
  if (!msg?.text) return Response.json({ ok: true });

  const chatId: number = msg.chat.id;
  const userId = String(msg.from?.id);
  if (!allowed.includes(userId)) return Response.json({ ok: true });

  // Evita processar o mesmo update duas vezes (Telegram reenvia se demorar)
  const { error: dupErr } = await supabase
    .from("telegram_updates")
    .insert({ update_id: update.update_id });
  if (dupErr) return Response.json({ ok: true });

  try {
    await sendTyping(chatId);
    const reply = await runAgent(chatId, msg.text);
    await sendMessage(chatId, reply);
  } catch (e) {
    console.error(e);
    await sendMessage(chatId, "Deu um erro aqui. Tenta de novo em instantes.");
  }

  return Response.json({ ok: true });
}
