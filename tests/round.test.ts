import assert from "node:assert/strict";
import { test } from "node:test";
import { createRound } from "../apps/host/round";

test("waits for first input, then counts wall time even with neutral input", () => {
  const round = createRound(120);
  assert.equal(round.advance(90000, false).remaining, 120);
  assert.equal(round.advance(100000, true).state, "running");
  assert.equal(round.advance(110000, false).remaining, 110);
});

test("a long frame or hidden tab still expires the round", () => {
  const round = createRound(120);
  round.advance(1000, true);
  assert.deepEqual(round.advance(130000, false), { state: "lost", elapsed: 120, remaining: 0 });
  assert.equal(round.win(130001).state, "lost");
});

test("winning freezes the elapsed and remaining time", () => {
  const round = createRound(120);
  round.advance(1000, true);
  assert.equal(round.win(11500).state, "won");
  assert.deepEqual(round.advance(999999, true), { state: "won", elapsed: 10.5, remaining: 109.5 });
});

test("reaching the goal at the deadline is a loss", () => {
  const round = createRound(10);
  round.advance(1000, true);
  assert.equal(round.win(11000).state, "lost");
});

test("restart resets a finished round and waits for movement", () => {
  const round = createRound(10);
  round.advance(0, true);
  round.advance(11000, true);
  assert.deepEqual(round.reset(), { state: "waiting", elapsed: 0, remaining: 10 });
  assert.equal(round.advance(50000, false).remaining, 10);
  assert.equal(round.advance(51000, true).state, "running");
});

test("exit stops a running countdown", () => {
  const round = createRound(10);
  round.advance(0, true);
  round.stop();
  assert.equal(round.advance(11000, true).state, "stopped");
});
