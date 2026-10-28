import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PresenceMember } from "@/types/share";
import { joinShareChannel, type ShareChannel } from "./realtime";

// BroadcastChannel처럼 송신자에게는 보내지 않고, 메시지를 비동기로 전달해요.
class MemoryChannel {
  static channels = new Set<MemoryChannel>();
  static sent: { name: string; data: unknown }[] = [];
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  closed = false;

  constructor(readonly name: string) {
    MemoryChannel.channels.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) throw new Error("closed channel");
    MemoryChannel.sent.push({ name: this.name, data });
    for (const channel of MemoryChannel.channels) {
      if (channel === this || channel.name !== this.name) continue;
      // 이벤트 하나마다 작업 하나를 예약해요. 무한 응답은 타이머 가드로 잡아요.
      const copy: unknown = JSON.parse(JSON.stringify(data));
      setTimeout(() => {
        if (!channel.closed) channel.onmessage?.(new MessageEvent("message", { data: copy }));
      }, 0);
    }
  }

  close(): void {
    this.closed = true;
    MemoryChannel.channels.delete(this);
  }
}

const host: PresenceMember = { clientId: "host", nickname: "발표자", role: "host", joinedAt: 100 };
const viewer: PresenceMember = { clientId: "viewer", nickname: "시청자", role: "viewer", joinedAt: 200 };
const channels: ShareChannel[] = [];

function join(code: string, clientId: string): ShareChannel {
  const channel = joinShareChannel(code, clientId, (name) => new MemoryChannel(name));
  channels.push(channel);
  return channel;
}

beforeEach(() => {
  vi.useFakeTimers({ loopLimit: 100 });
  MemoryChannel.channels.clear();
  MemoryChannel.sent = [];
});

afterEach(async () => {
  await Promise.all(channels.splice(0).map((channel) => channel.leave()));
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("mock share channel", () => {
  it("uses BroadcastChannel with the share code by default", async () => {
    vi.stubGlobal("BroadcastChannel", MemoryChannel);
    const sender = joinShareChannel("one", "host");
    const receiver = joinShareChannel("one", "viewer");
    channels.push(sender, receiver);
    const changed = vi.fn();
    receiver.onChanged(changed);
    await sender.sendChanged(7);
    await vi.runAllTimersAsync();
    expect(MemoryChannel.sent).toEqual([{ name: "share:one", data: { type: "changed", rev: 7 } }]);
    expect(changed.mock.calls).toEqual([[]]);
  });

  it("delivers only a changed hint with no arguments to peers on the same code", async () => {
    const sender = join("one", "host");
    const receiver = join("one", "viewer");
    const other = join("two", "other");
    const sent = vi.fn();
    const received = vi.fn();
    const isolated = vi.fn();
    sender.onChanged(sent);
    receiver.onChanged(received);
    other.onChanged(isolated);
    await sender.sendChanged(3);
    await vi.runAllTimersAsync();
    expect(received.mock.calls).toEqual([[]]);
    expect(sent).not.toHaveBeenCalled();
    expect(isolated).not.toHaveBeenCalled();
  });

  it("immediately provides the current presence and discovers existing members on late entry", async () => {
    const first = join("one", host.clientId);
    const firstPresence = vi.fn();
    first.onPresence(firstPresence);
    expect(firstPresence.mock.calls).toEqual([[[]]]);
    await first.track(host);
    expect(firstPresence).toHaveBeenLastCalledWith([host]);

    const second = join("one", viewer.clientId);
    const secondPresence = vi.fn();
    second.onPresence(secondPresence);
    await second.track(viewer);
    await vi.runAllTimersAsync();
    expect(firstPresence).toHaveBeenLastCalledWith([host, viewer]);
    expect(secondPresence).toHaveBeenLastCalledWith([viewer, host]);
    expect(MemoryChannel.sent).toHaveLength(3);

    const laterHandler = vi.fn();
    second.onPresence(laterHandler);
    expect(laterHandler).toHaveBeenCalledExactlyOnceWith([viewer, host]);
  });

  it("converges with simultaneous tracks and does not loop or duplicate client ids", async () => {
    const first = join("one", host.clientId);
    const second = join("one", viewer.clientId);
    const thirdMember: PresenceMember = { ...viewer, clientId: "third", joinedAt: 300 };
    const third = join("one", thirdMember.clientId);
    const handlers = [first, second, third].map((channel) => {
      const handler = vi.fn();
      channel.onPresence(handler);
      return handler;
    });
    await Promise.all([first.track(host), second.track(viewer), third.track(thirdMember)]);
    await vi.runAllTimersAsync();
    for (const handler of handlers) {
      const members = handler.mock.lastCall![0] as PresenceMember[];
      expect(members).toHaveLength(3);
      expect(members).toEqual(expect.arrayContaining([host, viewer, thirdMember]));
      expect(handler).toHaveBeenCalledTimes(4); // 초기 목록 + 자신 + 다른 두 명
    }
    expect(MemoryChannel.sent).toHaveLength(9);
  });

  it("replaces metadata by clientId and only notifies when the list changes", async () => {
    const first = join("one", host.clientId);
    const second = join("one", viewer.clientId);
    const presence = vi.fn();
    first.onPresence(presence);
    await first.track(host);
    await second.track(viewer);
    await vi.runAllTimersAsync();
    presence.mockClear();
    await second.track(viewer);
    await vi.runAllTimersAsync();
    expect(presence).not.toHaveBeenCalled();
    const updated = { ...viewer, nickname: "바뀐 이름" };
    await second.track(updated);
    await vi.runAllTimersAsync();
    expect(presence).toHaveBeenCalledExactlyOnceWith([host, updated]);
  });

  it("removes a departed member, closes the transport and makes leave idempotent", async () => {
    const first = join("one", host.clientId);
    const second = join("one", viewer.clientId);
    const presence = vi.fn();
    first.onPresence(presence);
    await first.track(host);
    await second.track(viewer);
    await vi.runAllTimersAsync();
    const transport = [...MemoryChannel.channels][1];
    await second.leave();
    await vi.runAllTimersAsync();
    expect(presence).toHaveBeenLastCalledWith([host]);
    expect(transport.closed).toBe(true);
    expect(MemoryChannel.sent.at(-1)?.data).toEqual({ type: "leave", clientId: "viewer" });
    const messageCount = MemoryChannel.sent.length;
    await second.leave();
    await second.track(viewer);
    await second.sendChanged(9);
    expect(MemoryChannel.sent).toHaveLength(messageCount);
  });

  it("announces departure and closes on pagehide, removing its page listener", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const channel = join("one", host.clientId);
    await channel.track(host);
    const transport = [...MemoryChannel.channels][0];
    window.dispatchEvent(new Event("pagehide"));
    expect(MemoryChannel.sent.at(-1)?.data).toEqual({ type: "leave", clientId: "host" });
    expect(transport.closed).toBe(true);
    expect(remove).toHaveBeenCalledWith("pagehide", expect.any(Function));
    const messageCount = MemoryChannel.sent.length;
    window.dispatchEvent(new Event("pagehide"));
    await channel.leave();
    expect(MemoryChannel.sent).toHaveLength(messageCount);
  });

  it("unsubscribes changed and presence handlers independently", async () => {
    const first = join("one", host.clientId);
    const second = join("one", viewer.clientId);
    const changed = vi.fn();
    const presence = vi.fn();
    const remainingChanged = vi.fn();
    const remainingPresence = vi.fn();
    const offChanged = first.onChanged(changed);
    const offPresence = first.onPresence(presence);
    first.onChanged(remainingChanged);
    first.onPresence(remainingPresence);
    offChanged();
    offChanged();
    offPresence();
    presence.mockClear();
    await second.track(viewer);
    await second.sendChanged(1);
    await vi.runAllTimersAsync();
    expect(changed).not.toHaveBeenCalled();
    expect(presence).not.toHaveBeenCalled();
    expect(remainingChanged.mock.calls).toEqual([[]]);
    expect(remainingPresence).toHaveBeenLastCalledWith([viewer]);
  });

  it.each([
    null, [], "changed", {}, { type: "unknown" },
    { type: "changed" }, { type: "changed", rev: "1" },
    { type: "changed", rev: -1 }, { type: "changed", rev: 0.5 },
    { type: "presence" }, { type: "presence", member: null, requestReply: true },
    { type: "presence", member: { ...viewer, clientId: "" }, requestReply: true },
    { type: "presence", member: { ...viewer, nickname: 3 }, requestReply: true },
    { type: "presence", member: { ...viewer, role: "admin" }, requestReply: true },
    { type: "presence", member: { ...viewer, joinedAt: "200" }, requestReply: true },
    { type: "presence", member: viewer },
    { type: "presence", member: viewer, requestReply: "yes" },
    { type: "leave" }, { type: "leave", clientId: 1 }, { type: "leave", clientId: "" },
  ])("ignores malformed messages: %j", async (data) => {
    const channel = join("one", host.clientId);
    const changed = vi.fn();
    const presence = vi.fn();
    channel.onChanged(changed);
    channel.onPresence(presence);
    await channel.track(host);
    presence.mockClear();
    const raw = new MemoryChannel("share:one");
    raw.postMessage(data);
    const count = MemoryChannel.sent.length;
    await vi.runAllTimersAsync();
    expect(changed).not.toHaveBeenCalled();
    expect(presence).not.toHaveBeenCalled();
    expect(MemoryChannel.sent).toHaveLength(count);
    raw.close();
  });

  it("provides isolated presence snapshots and does not persist nicknames", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const channel = join("one", host.clientId);
    const meta = { ...host };
    await channel.track(meta);
    meta.nickname = "외부 수정";
    channel.onPresence((members) => { members[0].nickname = "핸들러 수정"; members.pop(); });
    const observer = vi.fn();
    channel.onPresence(observer);
    expect(observer).toHaveBeenLastCalledWith([host]);
    expect(storage).not.toHaveBeenCalled();
  });

  it("cleans up even when broadcasting departure fails", async () => {
    const channel = join("one", host.clientId);
    await channel.track(host);
    const transport = [...MemoryChannel.channels][0];
    vi.spyOn(transport, "postMessage").mockImplementation(() => { throw new Error("unavailable"); });
    await expect(channel.leave()).resolves.toBeUndefined();
    expect(transport.closed).toBe(true);
    await expect(channel.leave()).resolves.toBeUndefined();
  });
});
