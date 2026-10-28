import type { Metadata } from "next";
import ChatApp from "@/components/ChatApp";

export const metadata: Metadata = { title: "Chat · Antares A.I Capella" };

export default function ChatPage() {
  return <ChatApp />;
}
