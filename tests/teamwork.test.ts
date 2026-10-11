import assert from "node:assert/strict";
import { test } from "node:test";
import { teamworkBoost } from "../apps/host/teamwork";
import { createMazePhysics } from "../apps/host/physics";
import { generateMaze } from "../apps/host/maze";

test("aligned players get a capped boost even with different tilt strengths", () => {
  assert.equal(teamworkBoost([{ x: 1, y: 0 }, { x: .2, y: 0 }]), 1.75);
  assert.equal(teamworkBoost(Array(10).fill({ x: 1, y: 0 })), 1.75);
});

test("single, neutral, perpendicular, and opposing inputs do not earn a boost", () => {
  for (const inputs of [[], [{ x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 1, y: 0 }, { x: -1, y: 0 }], [{ x: 1, y: 0 }, { x: 0, y: 1 }]]) {
    assert.equal(teamworkBoost(inputs), 1);
  }
});

test("neutral players reduce the bonus and near agreement gets a smaller boost", () => {
  assert.ok(teamworkBoost([{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }]) < 1.75);
  const partial = teamworkBoost([{ x: 1, y: 0 }, { x: 1, y: .3 }]);
  assert.ok(partial > 1 && partial < 1.75);
});

test("boost increases actual ball acceleration without adding motion at neutral", () => {
  const maze = generateMaze(100, 1, 42);
  const normal = createMazePhysics(maze);
  const boosted = createMazePhysics(maze);
  for (let i = 0; i < 10; i++) {
    normal.step({ x: .3, y: 0 });
    boosted.step({ x: .3, y: 0 }, 1.75);
  }
  assert.ok(boosted.ball.x > normal.ball.x);
  const neutral = createMazePhysics(maze);
  const before = neutral.ball.x;
  for (let i = 0; i < 10; i++) neutral.step({ x: 0, y: 0 }, 1.75);
  assert.equal(neutral.ball.x, before);
});
