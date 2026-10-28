import { runAntares, type Mode } from "@/lib/antares";
import { consumeMessage, currentUser } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { appendMessage, getConversation, updateMessage, type Source } from "@/lib/store";

const MAX_INPUT = 20_000;

/**
 * POST { conversationId, text, mode, device }
 * Streams newline-delimited JSON events back to the sender, and mirrors the reply
 * into the store as it grows so the user's other devices can follow along live.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const spaceId = user.spaceId;
  const plan = PLANS[user.plan];

  const body = await request.json().catch(() => null);
  const { conversationId, text, device } = body ?? {};
  const mode: Mode = body?.mode === "research" ? "research" : "chat";

  if (mode === "research" && !plan.research) {
    return Response.json(
      { error: "Deep research is part of Pro and Max. Upgrade on the pricing page.", upgrade: true },
      { status: 402 },
    );
  }

  if (typeof text !== "string" || !text.trim() || text.length > MAX_INPUT) {
    return Response.json({ error: "Message is empty or too long" }, { status: 400 });
  }
  if (!(await getConversation(spaceId, conversationId))) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (!(await consumeMessage(user.id))) {
    return Response.json(
      {
        error: `You've used all ${plan.dailyMessages} messages on the ${plan.name} plan today. Upgrade for more, or come back tomorrow.`,
        upgrade: true,
      },
      { status: 429 },
    );
  }

  await appendMessage(spaceId, conversationId, { role: "user", text, device });
  const history = (await getConversation(spaceId, conversationId))!.messages;
  const reply = (await appendMessage(spaceId, conversationId, {
    role: "assistant",
    text: "",
    streaming: true,
  }))!;

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    cancel() {
      cancelled = true;
    },
    async start(controller) {
      // If the sending device disconnects (the user walked out the door), keep generating:
      // the reply is still saved and the next device picks it up.
      let open = true;
      const send = (obj: unknown) => {
        if (!open || cancelled) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          open = false;
        }
      };
      let full = "";
      const sources: Source[] = [];
      let lastSync = 0;
      const sync = (streaming: boolean) =>
        updateMessage(spaceId, conversationId, reply.id, { text: full, sources, streaming });

      send({ type: "start", messageId: reply.id });
      try {
        for await (const ev of runAntares(history, mode)) {
          if (ev.type === "text") full += ev.text;
          if (ev.type === "source") sources.push(ev.source);
          if (ev.type === "error") full += `\n\n_${ev.message}_`;
          send(ev);
          if (Date.now() - lastSync > 400) {
            lastSync = Date.now();
            await sync(true);
          }
        }
      } catch (err) {
        console.error("Antares stream failed", err);
        full += "\n\n_Antares hit an error while answering. Please try again._";
        send({ type: "error", message: "Antares hit an error while answering." });
      }
      await sync(false);
      send({ type: "done" });
      if (open) controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
