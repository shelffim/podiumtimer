import { z } from "zod";
import type { PresenceMember, PresenceRole } from "@/types/share";

export type ShareChannel = {
  // 변경 신호는 재조회 힌트예요. rev나 실행 상태를 핸들러에 전달하지 않아요.
  onChanged(handler: () => void): () => void;
  onPresence(handler: (members: PresenceMember[]) => void): () => void;
  track(meta: { nickname: string; role: PresenceRole; joinedAt: number }): Promise<void>;
  sendChanged(rev: number): Promise<void>;
  leave(): Promise<void>;
};

type ChannelTransport = {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
  close(): void;
};

// 전송 메시지의 모양만 검사해요. 닉네임 입력 정책과 입장 판정은 lib에서 맡아요.
const clientIdSchema = z.string().min(1);
const memberSchema = z.object({
  clientId: clientIdSchema,
  nickname: z.string(),
  role: z.enum(["host", "viewer"]),
  joinedAt: z.number(),
});
const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("changed"), rev: z.number().int().nonnegative() }),
  z.object({ type: z.literal("presence"), member: memberSchema, requestReply: z.boolean() }),
  z.object({ type: z.literal("leave"), clientId: clientIdSchema }),
]);

function sameMember(a: PresenceMember | null | undefined, b: PresenceMember): boolean {
  return a?.clientId === b.clientId && a.nickname === b.nickname
    && a.role === b.role && a.joinedAt === b.joinedAt;
}

export function joinShareChannel(
  code: string,
  clientId: string,
  createChannel: (name: string) => ChannelTransport = (name) => new BroadcastChannel(name),
): ShareChannel {
  const channel = createChannel(`share:${code}`);
  const changedHandlers = new Set<() => void>();
  const presenceHandlers = new Set<(members: PresenceMember[]) => void>();
  const peers = new Map<string, PresenceMember>();
  let own: PresenceMember | null = null;
  let closed = false;

  function snapshot(): PresenceMember[] {
    return [...(own ? [own] : []), ...peers.values()].map((member) => ({ ...member }));
  }

  function notifyPresence(): void {
    for (const handler of presenceHandlers) handler(snapshot());
  }

  function announce(requestReply: boolean): void {
    if (!closed && own) channel.postMessage({ type: "presence", member: own, requestReply });
  }

  function close(): void {
    if (closed) return;
    closed = true;
    try {
      channel.postMessage({ type: "leave", clientId });
    } catch {
      // 퇴장 알림에 실패해도 탭의 채널과 이벤트 핸들러는 정리해요.
    } finally {
      channel.onmessage = null;
      channel.close();
      window.removeEventListener("pagehide", close);
      changedHandlers.clear();
      presenceHandlers.clear();
      peers.clear();
      own = null;
    }
  }

  channel.onmessage = ({ data }) => {
    if (closed) return;
    const parsed = messageSchema.safeParse(data);
    if (!parsed.success) return;
    const message = parsed.data;
    if (message.type === "changed") {
      for (const handler of changedHandlers) handler();
    } else if (message.type === "presence") {
      if (message.member.clientId === clientId) return;
      if (!sameMember(peers.get(message.member.clientId), message.member)) {
        peers.set(message.member.clientId, message.member);
        notifyPresence();
      }
      // 참가 알림에만 한 번 응답해요. 응답에는 다시 응답하지 않아요.
      if (message.requestReply) announce(false);
    } else if (peers.delete(message.clientId)) {
      notifyPresence();
    }
  };
  window.addEventListener("pagehide", close);

  return {
    onChanged(handler) {
      if (!closed) changedHandlers.add(handler);
      return () => { changedHandlers.delete(handler); };
    },
    onPresence(handler) {
      if (!closed) {
        presenceHandlers.add(handler);
        handler(snapshot());
      }
      return () => { presenceHandlers.delete(handler); };
    },
    async track({ nickname, role, joinedAt }) {
      if (closed) return;
      const member = { clientId, nickname, role, joinedAt };
      if (!sameMember(own, member)) {
        own = member;
        notifyPresence();
      }
      announce(true);
    },
    async sendChanged(rev) {
      if (!closed) channel.postMessage({ type: "changed", rev });
    },
    async leave() {
      close();
    },
  };
}
