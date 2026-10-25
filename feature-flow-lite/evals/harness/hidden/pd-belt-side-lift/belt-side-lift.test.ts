import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { Playtest, level } from '../src/playtest';

let p: Playtest;

beforeAll(() => {
  p = new Playtest();
});

afterAll(async () => {
  await p.close();
});

// A column belt that climbs against the pull takes a player who stands on the
// floor beside it. Player.updatePhysics in src/logic/player.lua probes both
// sides of a grounded player for a column belt's open face. A climbing one
// lifts them off the floor and sets the cling, so from the next frame they
// ride the run the same as a rider who reached it in the air.

// The column runs from row 9 down to the floor, so a player who walks right
// stops flush against its open face with their feet on the floor. `X` is the
// column glyph. The wall behind it is the mount.
const LEFT_FACE_GRID = `
				..................
				..................
				..................
				..................
				..................
				..................
				..................
				..................
				........X#........
				........X#........
				........X#........
				........X#........
				........X#........
				........X#........
				........X#....ee..
				..P.....X#....Ee..
				##################
			`;
// The mirror: the wall is on the left, so the open face looks right, and a
// player who walks left stops against it.
const RIGHT_FACE_GRID = `
				..................
				..................
				..................
				..................
				..................
				..................
				..................
				..................
				........#X........
				........#X........
				........#X........
				........#X........
				........#X........
				........#X........
				..ee....#X........
				..Ee....#X....P...
				##################
			`;
// The y of a player whose feet rest on the floor at row 17.
const FLOOR_Y = 16 * 16 - 8;

/**
 * Walk toward the run until the player stops against it, then let go of the
 * pad and watch for `frames` frames. Returns the highest point reached
 * (screen y grows downward, so that is the minimum y).
 */
async function standBesideAndPeak(
  grid: string,
  glyph: string,
  walk: 'left' | 'right',
  frames: number,
) {
  const col = grid === LEFT_FACE_GRID ? 9 : 10;
  const belts = glyph === '#' ? [] : [{ at: [col, 9] as [number, number], speed: 6 }];
  await p.reset(level(grid.replaceAll('X', glyph), { belts }));
  await p.runUntil((obs) => obs.player.isGrounded, { maxFrames: 90 });
  // The walk ends the frame the run stops it, or the frame the belt
  // takes the player off the floor, whichever the belt allows.
  let lastX = p.player().x;
  for (let i = 0; i < 60; i++) {
    const obs = await p.step({ [walk]: true });
    if (!obs.player.isGrounded || obs.player.x === lastX) break;
    lastX = obs.player.x;
  }
  let minY = p.player().y;
  for (let i = 0; i < frames; i++) {
    const obs = await p.step();
    if (obs.player.y < minY) minY = obs.player.y;
  }
  return minY;
}

describe('a climbing column belt lifts a player who stands beside it', () => {
  it('takes them off the floor and up the run with no input', async () => {
    const peak = await standBesideAndPeak(LEFT_FACE_GRID, "'", 'right', 20);
    // Twenty frames of a 6 px/frame climb, less the slide, rise well
    // over two tiles.
    expect(peak).toBeLessThan(FLOOR_Y - 32);
    expect(p.player().isOnWall).toBe(true);
  });

  it('throws them off the top of the run', async () => {
    const peak = await standBesideAndPeak(LEFT_FACE_GRID, "'", 'right', 60);
    // The run's top is row 9. The launch carries them above it.
    expect(peak).toBeLessThan(8 * 16);
  });

  it('lifts from the right-facing side as well', async () => {
    const peak = await standBesideAndPeak(RIGHT_FACE_GRID, "'", 'left', 20);
    expect(peak).toBeLessThan(FLOOR_Y - 32);
  });

  it('leaves a player beside a column that runs down on the floor', async () => {
    const peak = await standBesideAndPeak(LEFT_FACE_GRID, ',', 'right', 20);
    expect(peak).toBe(FLOOR_Y);
    expect(p.player().isGrounded).toBe(true);
  });

  it('leaves a player beside a plain wall on the floor', async () => {
    const peak = await standBesideAndPeak(LEFT_FACE_GRID, '#', 'right', 20);
    expect(peak).toBe(FLOOR_Y);
  });
});
