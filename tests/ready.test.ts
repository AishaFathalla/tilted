import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { WebSocket } from "ws";
import type { ServerMessage } from "../shared/protocol";

test("readiness is shared, validated, reset by the host, and updated on departure", { timeout: 15000 }, async (t) => {
  // Run the actual server on an ephemeral port, without interfering with the dev room.
  const source = await readFile(new URL("../server/index.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source.replace("port: 8080", "port: 0"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const server = spawn(process.execPath, ["--input-type=module", "-e", compiled +
    '\nserver.on("listening", () => console.log("PORT:" + server.address().port));'], {
    cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => server.kill());
  const port = await new Promise<number>((resolve, reject) => {
    server.on("error", reject);
    server.on("exit", (code) => reject(new Error(`Server exited: ${code}`)));
    server.stdout.on("data", (data) => {
      const match = String(data).match(/PORT:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
  });
  async function connect() {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    t.after(() => socket.terminate());
    const messages: ServerMessage[] = [];
    let notify: (() => void) | undefined;
    socket.on("message", (data) => { messages.push(JSON.parse(String(data))); notify?.(); });
    await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    return {
      socket,
      send(message: object) { socket.send(JSON.stringify(message)); },
      async next<T extends ServerMessage["type"]>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
        const timeout = setTimeout(() => notify?.(), 3000);
        const deadline = Date.now() + 3000;
        try {
          while (true) {
            const index = messages.findIndex((message) => message.type === type);
            if (index >= 0) return messages.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>;
            if (Date.now() >= deadline) throw new Error(`Missing ${type} message`);
            await new Promise<void>((resolve) => { notify = resolve; });
          }
        } finally { clearTimeout(timeout); notify = undefined; }
      },
    };
  }
  const host = await connect();
  host.send({ type: "create" });
  const { room } = await host.next("created");
  await host.next("players");
  const first = await connect();
  first.send({ type: "join", room, name: "One" });
  await first.next("joined");
  assert.equal((await host.next("players")).players[0].ready, false);
  await first.next("players");
  const second = await connect();
  second.send({ type: "join", room, name: "Two" });
  await second.next("joined");
  await host.next("players"); await first.next("players"); await second.next("players");
  first.send({ type: "ready", ready: true });
  assert.deepEqual((await host.next("players")).players.map((p) => p.ready), [true, false]);
  assert.deepEqual((await first.next("players")).players.map((p) => p.ready), [true, false]);
  await second.next("players");
  second.send({ type: "ready", ready: "yes" });
  assert.match((await second.next("error")).message, /true or false/);
  second.send({ type: "reset_ready" });
  assert.match((await second.next("error")).message, /Only the host/);
  second.send({ type: "ready", ready: true });
  assert.ok((await host.next("players")).players.every((p) => p.ready));
  await first.next("players"); await second.next("players");
  first.send({ type: "recalibrate" });
  await host.next("round_restart");
  assert.ok((await host.next("players")).players.every((p) => !p.ready));
  await first.next("players"); await second.next("players");
  first.send({ type: "ready", ready: true });
  await host.next("players"); await first.next("players"); await second.next("players");
  first.send({ type: "ready", ready: false });
  assert.deepEqual((await host.next("players")).players.map((p) => p.ready), [false, false]);
  await first.next("players"); await second.next("players");
  host.send({ type: "reset_ready" });
  await host.next("ready_reset");
  assert.ok((await host.next("players")).players.every((p) => !p.ready));
  await first.next("players"); await second.next("players");
  second.socket.close();
  assert.equal((await host.next("players")).players.length, 1);
});
