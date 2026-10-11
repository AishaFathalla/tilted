import assert from "node:assert/strict";
import { test } from "node:test";
import { distancesFrom, generateChallengeMaze, openNeighbors } from "../apps/host/maze";

test("challenge mazes are larger, deterministic, connected, and have no shortcuts", () => {
  for (const seed of [0, 1, 42, 2026, 4294967295]) {
    const maze = generateChallengeMaze(seed);
    assert.equal(maze.cols, 20);
    assert.equal(maze.rows, 14);
    assert.deepEqual(maze, generateChallengeMaze(seed));
    assert.ok([...distancesFrom(maze, maze.start)].every((distance) => distance >= 0));
    let exits = 0;
    for (let row = 0; row < maze.rows; row++) {
      for (let col = 0; col < maze.cols; col++) exits += openNeighbors(maze, { col, row }).length;
    }
    assert.equal(exits / 2, maze.cols * maze.rows - 1);
    for (let row = 0; row < maze.rows; row++) assert.equal(maze.east[row * maze.cols + maze.cols - 1], true);
    for (let col = 0; col < maze.cols; col++) assert.equal(maze.south[(maze.rows - 1) * maze.cols + col], true);
  }
});

test("start and goal span the longest route in the maze", () => {
  const maze = generateChallengeMaze(42);
  const routeLength = distancesFrom(maze, maze.start)[maze.goal.row * maze.cols + maze.goal.col];
  for (let row = 0; row < maze.rows; row++) {
    for (let col = 0; col < maze.cols; col++) {
      assert.ok(Math.max(...distancesFrom(maze, { col, row })) <= routeLength);
    }
  }
});
