import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';
import { Playtest, level } from '../src/playtest';

let p: Playtest;

beforeAll(() => {
  p = new Playtest();
});

afterAll(async () => {
  await p.close();
});

// The player stands on the floor row. Its vertical center is the row above
// the wall. A `+` placed on the same row shares the player's y value. Blast
// and body distances are then purely horizontal and easy to compare.
//
// Geometry recap (tiles are 16px, centers at (col-1)*16+8, 0-based here):
//   - player spawns at col 1  -> x = 24
//   - blast radius is 24. The ring check gives the player a 16px (half 8)
//     box. When the orb center is within 24+8 = 32px of the player, the ring
//     kills.
//   - the orb body hitbox is inset to 14px (half 7). When the centers are
//     within 8+7 = 15px, the bodies overlap (a body kill).
//   - orbs hold still until the player is out of the spawn portal. The
//     frame the player can move is the orb's first step.
//   - the orb drifts at 0.5px/frame and the first blast fires on its 60th
//     step. Before the ring opens, the orb travels 30px. It starts 30px
//     farther out than its position at ring-open time.

// The orb starts far to the right. It never reaches the player, and its
// blast never touches the player during the single cycle these tests watch.
// This isolates the emission cycle.
const FAR = level(`
	..............
	..........ee..
	.P....+...Ee..
	##############
`);

// The orb sits in a pocket in the rock, 96px out. An orb looks out of the
// rock around it, so it sees the player and wakes. It then drifts straight
// through the rock between them.
const DRIFT = level(`
	..............
	..........ee..
	.P..###+#.Ee..
	##############
`);

// A wall stands between the player and the orb, with open air on both
// sides of it. The orb is well inside its wake radius but cannot see the
// player, so it sleeps.
const HIDDEN = level(`
	..............
	..........ee..
	.P..#..+..Ee..
	##############
`);

// Orb at x=72 (col 4), 48px out. At the first blast (frame 60), it is ~18px
// from the player. This is inside the 32px ring reach but outside the 15px
// body overlap. So the ring, not the body, lands the kill.
const NEAR = level(`
	..............
	..........ee..
	.P..+.....Ee..
	##############
`);

// Orb at x=56 (col 3), only 32px out. It reaches the player's body (<15px)
// around frame 35, well before the first blast at frame 60. This is a kill
// by contact.
const BODY = level(`
	..............
	..........ee..
	.P.+......Ee..
	##############
`);

const orb = () => p.obs.pulses[0];

// Step through the spawn emerge. On the frame this returns, the player can
// move and every orb has taken its first step.
const emerge = async () => {
  const frames = await p.runUntil((obs) => !obs.player.isEmerging, { maxFrames: 60 });
  expect(frames).toBeGreaterThanOrEqual(0);
};

describe('pulse orbs', () => {
  it('hold still and do not count down while the player emerges', async () => {
    await p.reset(NEAR);
    const startX = orb().x;
    expect(p.player().isEmerging).toBe(true);
    let frames = 0;
    for (;;) {
      await p.step();
      if (!p.player().isEmerging) break;
      frames++;
      // The orb is in sight and inside its chase radius, but it waits.
      expect(orb().x).toBe(startX);
      expect(orb().chasing).toBe(false);
      expect(orb().framesUntilRing).toBe(60);
      expect(orb().ringActive).toBe(false);
    }
    expect(frames).toBeGreaterThan(20);
    expect(p.lifecycle()).toBe('PLAYING');

    // The frame the player can move, the orb wakes and takes its first step.
    expect(orb().chasing).toBe(true);
    expect(orb().x).toBeLessThan(startX);
    expect(orb().framesUntilRing).toBe(59);
  });

  it('drift toward the player through a solid wall', async () => {
    await p.reset(DRIFT);
    await emerge();
    const startX = orb().x;
    const playerX = p.player().x;
    expect(startX).toBeGreaterThan(playerX); // orb starts to the right

    // Idle 40 frames with no input. This is well before the first blast
    // (step 60) and long before the orb can reach the player, so nobody
    // dies. The orb spends the whole time inside the rock.
    await p.hold(40);

    expect(p.lifecycle()).toBe('PLAYING');
    // The orb moved toward the player at 0.5px/frame despite the wall:
    // 40 * 0.5.
    expect(startX - orb().x).toBeCloseTo(20, 5);
    expect(orb().x).toBeLessThan(startX);
    expect(orb().x).toBeGreaterThan(playerX); // approaching, not overshot
  });

  it('sleep while a wall hides the player', async () => {
    await p.reset(HIDDEN);
    await emerge();
    const startX = orb().x;
    await p.hold(40);
    expect(p.lifecycle()).toBe('PLAYING');
    expect(orb().chasing).toBe(false);
    expect(orb().x).toBe(startX);
  });

  it('flash a warning for the 12 frames before each blast', async () => {
    await p.reset(FAR);
    await emerge();
    expect(orb().windingUp).toBe(false);
    await p.runUntil(() => orb().framesUntilRing <= 13, { maxFrames: 90 });
    expect(orb().framesUntilRing).toBe(13);
    expect(orb().windingUp).toBe(false);
    await p.step();
    expect(orb().framesUntilRing).toBe(12);
    expect(orb().windingUp).toBe(true);
    await p.runUntil(() => orb().ringActive, { maxFrames: 20 });
    expect(orb().windingUp).toBe(false);
  });

  it('fire the first blast 60 frames after the player can move, ring open 15 frames at radius 24', async () => {
    await p.reset(FAR);
    // on spawn the countdown is a full period and no ring is out.
    expect(orb().framesUntilRing).toBe(60);
    expect(orb().ringActive).toBe(false);
    expect(orb().ringRadius).toBe(0);

    // the countdown starts on the frame the player can move, then ticks
    // down one per frame.
    await emerge();
    expect(orb().framesUntilRing).toBe(59);
    await p.hold(10);
    expect(orb().framesUntilRing).toBe(49);

    // Step to the first blast. tuning.orbBlastInterval=60, so ~60 orb steps
    // pass.
    const more = await p.runUntil(() => orb().ringActive, { maxFrames: 90 });
    expect(more).toBeGreaterThanOrEqual(0);
    const orbSteps = 1 + 10 + more + 1;
    expect(orbSteps).toBeGreaterThanOrEqual(58);
    expect(orbSteps).toBeLessThanOrEqual(62);

    // the ring opens at the fixed radius and the countdown resets to a full
    // period the instant it fires.
    expect(orb().ringRadius).toBe(24);
    expect(orb().framesUntilRing).toBe(60);

    // count how long the ring stays open: RING_LIFETIME=15 frames.
    let activeFrames = 1; // already active on this frame
    while (activeFrames < 40) {
      await p.step();
      if (!orb().ringActive) break;
      activeFrames++;
    }
    expect(activeFrames).toBe(15);
  });

  it('blast kills a player inside the ring (within 24px) when it opens', async () => {
    await p.reset(NEAR);
    await emerge();

    // DYING marks the kill frame. The world then runs a ~24-frame death
    // tail before the auto-pause (DEAD). The test asserts orb state here,
    // on the kill frame, while it still holds the moment-of-death values.
    const frames = await p.runUntil((obs) => obs.lifecycle === 'DYING', {
      maxFrames: 90,
    });
    expect(frames).toBeGreaterThanOrEqual(0);
    expect(p.lifecycle()).toBe('DYING');

    // died on the first blast (~frame 60), not by walking into the orb
    // earlier.
    expect(frames + 1).toBeGreaterThanOrEqual(55);
    expect(frames + 1).toBeLessThanOrEqual(64);

    // The ring was open. The orb body did not overlap the player
    // (centers more than 15px apart). So the blast caused the kill,
    // inside its 32px reach.
    expect(orb().ringActive).toBe(true);
    expect(orb().x - p.player().x).toBeGreaterThan(15);
    expect(orb().x - p.player().x).toBeLessThanOrEqual(32);

    // The death tail runs to completion and ends at the rewind pause.
    const tail = await p.runUntil((obs) => obs.lifecycle === 'DEAD', {
      maxFrames: 40,
    });
    expect(tail).toBeGreaterThanOrEqual(0);
  });

  it('a player ~40px from the orb survives that same first blast', async () => {
    await p.reset(FAR);
    await emerge();
    // FAR places the orb so the player's near edge is outside the 24px
    // ring radius. When the ring opens, the near edge is ~42px from the
    // orb center. Idle across the whole first blast window (fires at 60,
    // stays open 15 frames, closes by ~75).
    await p.hold(80);
    expect(p.lifecycle()).toBe('PLAYING');
  });

  it('touching the orb body kills, even with no blast out', async () => {
    await p.reset(BODY);
    await emerge();

    const frames = await p.runUntil((obs) => obs.lifecycle === 'DYING', {
      maxFrames: 90,
    });
    expect(frames).toBeGreaterThanOrEqual(0);
    expect(p.lifecycle()).toBe('DYING');

    // The player died well before the first blast (frame 60), with no
    // ring out. This is a body overlap (centers within 15px), not a
    // blast.
    expect(frames + 1).toBeLessThan(55);
    expect(orb().ringActive).toBe(false);
    expect(orb().x - p.player().x).toBeLessThan(15);
  });

  it('rewind scrubs the orb position and blast cycle back deterministically', async () => {
    await p.reset(FAR);
    await emerge();

    // Record the forward trajectory of the orb: x position and blast
    // countdown per frame (index 0 is the first frame the player can move).
    const traj: Array<{ x: number; fur: number }> = [{ x: orb().x, fur: orb().framesUntilRing }];
    for (let i = 0; i < 75; i++) {
      await p.step();
      traj.push({ x: orb().x, fur: orb().framesUntilRing });
    }
    // By this point, the orb moved left and a blast fired.
    expect(orb().x).toBeLessThan(traj[0].x);

    // Pause the game. The scrub position sits on the latest recorded
    // frame.
    await p.step({ pause: true });
    expect(p.lifecycle()).toBe('PAUSED');
    const pausedX = orb().x;
    const sp0 = p.obs.rewind.scrubPosition;

    // The recording starts after the spawn-assembly freeze. Those
    // frames are not recorded, so scrubPosition lags our own frame
    // counter by a constant offset. Derive the offset from the paused
    // frame, since it shows the latest state.
    const lastFrame = traj.length - 1;
    expect(pausedX).toBeCloseTo(traj[lastFrame].x, 5);
    const offset = lastFrame - sp0;

    // Scrub back in ~15-frame steps. At each scrub position, the orb's
    // x value and its blast countdown exactly match the forward
    // trajectory at that frame. So the whole orb state (chase and
    // emission) replays backward.
    let prevX = pausedX;
    for (let i = 0; i < 3; i++) {
      await p.step({ crank: 30 });
      const sp = p.obs.rewind.scrubPosition;
      const rec = traj[sp + offset];
      expect(rec).toBeDefined();
      expect(orb().x).toBeCloseTo(rec.x, 5);
      expect(orb().framesUntilRing).toBe(rec.fur);
      // When the test scrubs back, the orb moves toward where it
      // started (farther right).
      expect(orb().x).toBeGreaterThan(prevX);
      prevX = orb().x;
    }
  });
});
