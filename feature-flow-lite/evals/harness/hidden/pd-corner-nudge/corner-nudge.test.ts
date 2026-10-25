import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { Playtest, level } from '../src/playtest';

let p: Playtest;

beforeAll(() => {
  p = new Playtest();
});

afterAll(async () => {
  await p.close();
});

// The player is exactly one tile wide, so a 1-tile shaft overhead has no
// slack. A rising player whose head clips a ceiling corner by
// Constants.CORNER_NUDGE_DISTANCE (4px) or less slides clear of the corner
// and keeps the rise (processCollisions in src/logic/player.lua). A wider
// miss still stops the jump.

describe('a jump that clips the corner of a 1-tile shaft', () => {
  // A World 3 pipe: a 1-tile shaft (column 8, x 112-128) between two
  // climbing belts, over a floor the player walks up to. The shaft's mouth
  // is the bottom edge of row 10, at y 160. A player whose body is fully in
  // the shaft has y <= 152.
  const GRID = `
				................
				................
				..........ee....
				..........Ee....
				######'.'#######
				######'.'#######
				######'.'#######
				######'.'#######
				######'.'#######
				######'.'#######
				................
				................
				P...............
				################
			`;
  const MOUTH_Y = 160;
  const BELTS = {
    belts: [
      { at: [7, 5] as [number, number], speed: 5 },
      { at: [9, 5] as [number, number], speed: 5 },
    ],
  };

  /**
   * Spawn in column `col`, run right for `runFrames`, come to rest, then
   * jump straight up. Returns the x the jump starts from and the highest
   * point the jump reaches (the lowest y, since screen y grows downward).
   */
  async function restThenJump(col: number, runFrames: number) {
    const spawnRow = '.'.repeat(col - 1) + 'P' + '.'.repeat(16 - col);
    await p.reset(level(GRID.replace('P...............', spawnRow), BELTS));
    // Wait out the spawn freeze, walk, then let friction stop the player.
    await p.hold(40);
    if (runFrames > 0) {
      await p.hold(runFrames, { right: true });
    }
    await p.hold(30);
    const startX = p.player().x;

    let peakY = p.player().y;
    for (let i = 0; i < 40; i++) {
      await p.step({ jump: i < 12 });
      peakY = Math.min(peakY, p.player().y);
    }
    return { startX, peakY };
  }

  it('enters from dead centre (control)', async () => {
    const { startX, peakY } = await restThenJump(8, 0);
    expect(startX).toBe(120);
    expect(peakY).toBeLessThanOrEqual(MOUTH_Y - 8);
  });

  it.each([
    // [spawn column, run frames, expected rest x]
    [7, 3, 119.36],
    [6, 5, 119.72],
    [5, 7, 123.61],
  ])('enters from a rest %#px off centre', async (col, runFrames, restX) => {
    const { startX, peakY } = await restThenJump(col, runFrames);
    expect(startX).toBeCloseTo(restX, 1);
    expect(peakY).toBeLessThanOrEqual(MOUTH_Y - 8);
  });

  it('still bonks when the miss is wider than the nudge', async () => {
    // Rest x 113.67 puts the head 6.3px under the left wall, past the 4px
    // nudge. The head must stop at the mouth.
    const { startX, peakY } = await restThenJump(5, 6);
    expect(startX).toBeCloseTo(113.67, 1);
    expect(peakY).toBeGreaterThanOrEqual(MOUTH_Y + 8);
  });
});
