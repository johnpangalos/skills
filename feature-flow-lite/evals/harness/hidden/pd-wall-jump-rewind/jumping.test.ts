import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Playtest, level } from "../src/playtest";

let p: Playtest;

beforeAll(() => {
	p = new Playtest();
});

afterAll(async () => {
	await p.close();
});

// The spawn-assembly animation freezes the player for ~32 frames after every
// reset; wait until it is grounded and responding before driving it. Every
// inline grid needs exactly one exit (ee/Ee); the tests that aren't about
// reaching it park it in a far corner the player never touches.
async function settle() {
	await p.runUntil((o) => o.player.isGrounded, { maxFrames: 90 });
}

describe("variable jump height", () => {
	// Flat ground with generous headroom (a full 12-frame hold rises ~2.8
	// tiles; leaving the top of the grid is a death). Exit parked top-right.
	const FLAT = level(`
		..........ee
		..........Ee
		............
		............
		............
		............
		............
		.P..........
		############
	`);

	// Tap A for `hold` frames, release, then coast for a while, returning the
	// highest point reached (smallest y = highest).
	async function apex(hold: number): Promise<number> {
		await p.reset(FLAT);
		await settle();
		let minY = p.player().y;
		for (let i = 0; i < hold; i++) {
			await p.step({ jump: true });
			minY = Math.min(minY, p.player().y);
		}
		// coast (jump released) through the apex and back down.
		for (let i = 0; i < 40; i++) {
			await p.step();
			minY = Math.min(minY, p.player().y);
		}
		return minY;
	}

	it("a longer jump hold rises higher than a shorter one, up to the boost cap", async () => {
		// The jump-boost force ramps fast and caps at MAX_JUMP_FORCE by ~frame
		// 6, so a 6- and a 12-frame hold reach the exact same apex; sampling
		// 1/3/12 keeps three distinct heights to compare.
		const tap = await apex(1);
		const mid = await apex(3);
		const full = await apex(12);

		// smaller y = higher: longer holds jump higher, with clear margins so
		// this isn't measuring noise.
		expect(full).toBeLessThan(mid - 8);
		expect(mid).toBeLessThan(tap - 8);
	});
});

describe("coyote time", () => {
	// A short ledge (floor cols 1-2) then a deep pit, so the player has many
	// airborne frames after walking off before it reaches the lower floor.
	const LEDGE = level(`
		............ee
		............Ee
		..............
		.P............
		##............
		..............
		..............
		..............
		##############
	`);

	it("a jump within COYOTE_TIME of leaving the ledge still fires", async () => {
		await p.reset(LEDGE);
		await settle();

		// Walk off the ledge; the first airborne frame arms the coyote timer.
		await p.runUntil((o) => !o.player.isGrounded, {
			right: true,
			maxFrames: 60,
		});
		expect(p.player().coyoteTimer).toBeGreaterThan(0);
		expect(p.obs.hints.canJump).toBe(true);

		// Press jump on the very next frame (1 frame into the coyote window).
		await p.step({ jump: true, right: true });
		// The jump fired: upward velocity (negative vy).
		expect(p.player().vy).toBeLessThan(0);
	});

	it("a jump after the coyote window has lapsed does not fire", async () => {
		await p.reset(LEDGE);
		await settle();

		await p.runUntil((o) => !o.player.isGrounded, {
			right: true,
			maxFrames: 60,
		});
		// Fall (holding right) until the coyote window has fully elapsed.
		await p.runUntil((o) => o.player.coyoteTimer === 0, {
			right: true,
			maxFrames: 20,
		});
		expect(p.obs.hints.canJump).toBe(false);
		expect(p.player().vy).toBeGreaterThan(0);

		// Tapping jump now does nothing — no upward launch, still falling.
		await p.step({ jump: true, right: true });
		expect(p.player().vy).toBeGreaterThan(0);
	});
});

describe("jump buffer", () => {
	// Small ledge (floor cols 1-2) dropping onto a wide floor ~3 tiles below.
	const DROP = level(`
		............ee
		............Ee
		..............
		..............
		.P............
		##............
		..............
		..............
		##############
	`);

	it("a jump pressed just before landing fires on the landing frame", async () => {
		// Calibrate the airborne duration with a plain fall.
		await p.reset(DROP);
		await settle();
		await p.runUntil((o) => !o.player.isGrounded, {
			right: true,
			maxFrames: 60,
		});
		const airborne = await p.runUntil((o) => o.player.isGrounded, {
			right: true,
			maxFrames: 60,
		});
		expect(airborne).toBeGreaterThan(3);

		// Re-run and press jump ~3 frames before that landing — inside the
		// 6-frame buffer window.
		await p.reset(DROP);
		await settle();
		await p.runUntil((o) => !o.player.isGrounded, {
			right: true,
			maxFrames: 60,
		});
		await p.hold(airborne - 3, { right: true });
		await p.step({ jump: true, right: true });
		// The buffer is armed while the player is still airborne.
		expect(p.player().jumpBufferTimer).toBeGreaterThan(0);
		expect(p.player().isGrounded).toBe(false);

		// It lands and the buffered jump fires: the player launches back up
		// (upward vy) within a few frames of touching down.
		const launched = await p.runUntil((o) => o.player.vy < 0, {
			right: true,
			maxFrames: 12,
		});
		expect(launched).toBeGreaterThanOrEqual(0);
	});
});

describe("wall slide", () => {
	// Player spawns airborne beside a wall column (col 8); the left side is
	// open. Holding right keeps it pressed against the wall as it falls. Exit
	// parked on the far side of the wall, out of reach.
	const SHAFT = level(`
		.......#..ee..
		.......#..Ee..
		......P#......
		.......#......
		.......#......
		.......#......
		..............
		##############
	`);
	// A matching open column with no wall, for the free-fall comparison.
	const OPEN = level(`
		..........ee..
		..........Ee..
		......P.......
		..............
		..............
		..............
		..............
		##############
	`);

	it("clamps fall speed to WALL_SLIDE_SPEED against a wall", async () => {
		await p.reset(SHAFT);
		// Press into the wall; wait until sliding contact is established.
		await p.runUntil((o) => o.player.isOnWall, {
			right: true,
			maxFrames: 60,
		});
		// A few more frames so the slide clamp has fully taken hold.
		await p.hold(3, { right: true });
		expect(p.player().isOnWall).toBe(true);
		expect(p.player().wallDirection).not.toBe(0);
		// vy is pinned to WALL_SLIDE_SPEED (=3), never the ~free-fall rate.
		expect(p.player().vy).toBeGreaterThan(0);
		expect(p.player().vy).toBeLessThanOrEqual(3.5);

		// Same fall with no wall reaches a clearly higher speed.
		await p.reset(OPEN);
		await p.runUntil((o) => !o.player.isGrounded && o.player.vy > 0.5, {
			maxFrames: 60,
		});
		await p.hold(9);
		expect(p.player().vy).toBeGreaterThan(5);
	});
});

describe("terminal velocity", () => {
	// A tall open drop: the player steps off a small ledge and free-falls
	// ~20 tiles. Gravity (0.7/frame) reaches the 12px/frame cap after ~17
	// frames (~7 tiles), leaving plenty of capped frames to observe.
	const TALL_DROP = level(`
		.P...........ee
		##...........Ee
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		...............
		###############
	`);

	it("caps free-fall speed at 12px/frame", async () => {
		await p.reset(TALL_DROP);
		await settle();
		// Walk off the ledge, then release and ride the fall down.
		await p.runUntil((o) => !o.player.isGrounded && o.player.vy > 0, {
			right: true,
			maxFrames: 60,
		});
		let maxVy = 0;
		for (let i = 0; i < 120 && !p.player().isGrounded; i++) {
			await p.step();
			maxVy = Math.max(maxVy, p.player().vy);
		}
		expect(p.player().isGrounded).toBe(true);
		// The cap was reached and never exceeded.
		expect(maxVy).toBeGreaterThan(11.5);
		expect(maxVy).toBeLessThanOrEqual(12.05);
	});

	it("caps the upward fall the same way under flipped gravity", async () => {
		// Mirror of TALL_DROP: touch g on the floor and "fall" up the shaft
		// to the ceiling.
		await p.reset(
			level(`
				###############
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				...............
				.............ee
				.P..g........Ee
				###############
			`,
				{ switches: [{ id: "g", gravity: true }] },
			),
		);
		await settle();
		await p.runUntil((o) => o.player.gravityDirection === -1, {
			right: true,
			maxFrames: 120,
		});
		await p.runUntil((o) => !o.player.isGrounded, { maxFrames: 30 });
		let minVy = 0;
		for (let i = 0; i < 120 && !p.player().isGrounded; i++) {
			await p.step();
			minVy = Math.min(minVy, p.player().vy);
		}
		// Landed on the ceiling; the upward fall was pinned at -12.
		expect(p.player().isGrounded).toBe(true);
		expect(minVy).toBeLessThan(-11.5);
		expect(minVy).toBeGreaterThanOrEqual(-12.05);
	});
});

describe("wall jump", () => {
	const SHAFT = level(`
		.......#..ee..
		.......#..Ee..
		......P#......
		.......#......
		.......#......
		.......#......
		..............
		##############
	`);

	it("pushes away from the wall and locks out movement input", async () => {
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isOnWall, {
			right: true,
			maxFrames: 60,
		});

		// Jump off the right-hand wall (still holding right, into the wall).
		await p.step({ jump: true, right: true });
		// Pushed left, away from the wall, at ~WALL_JUMP_FORCE_X.
		expect(p.player().vx).toBeLessThanOrEqual(-3);
		expect(p.player().vy).toBeLessThan(0);
		expect(p.player().wallJumpLockoutTimer).toBeGreaterThan(0);

		// For the lockout window, holding right (back into the wall) is
		// ignored: the away-from-wall velocity is not reversed.
		await p.hold(4, { right: true });
		expect(p.player().vx).toBeLessThan(0);
	});
});

describe("wall coyote", () => {
	const SHAFT = level(`
		.......#..ee..
		.......#..Ee..
		......P#......
		.......#......
		.......#......
		.......#......
		..............
		##############
	`);

	it("a wall jump still fires just after leaving the wall", async () => {
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isOnWall, {
			right: true,
			maxFrames: 60,
		});

		// Nudge left for one frame to break wall contact; the wall-coyote
		// window keeps a wall jump available for a few more frames.
		await p.step({ left: true });
		expect(p.player().isOnWall).toBe(false);
		expect(p.obs.hints.canWallJump).toBe(true);

		// Jump inside the window: still a wall jump (upward + shoved away).
		await p.step({ jump: true });
		expect(p.player().vy).toBeLessThan(0);
		expect(p.player().vx).toBeLessThanOrEqual(-3);
	});

	it("spends the window on the jump it buys, with no free second hop", async () => {
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isOnWall, {
			right: true,
			maxFrames: 60,
		});

		// Same coyote-window wall jump as above...
		await p.step({ left: true });
		await p.step({ jump: true });
		// ...which must consume the window, not leave it running with no
		// wallDirection left to push with.
		expect(p.obs.hints.canWallJump).toBe(false);

		// Release A and press again while the window would still have been
		// open: the second press buys nothing, so the rise keeps decaying
		// under gravity and the wall jump's push survives.
		await p.step({});
		const vy = p.player().vy;
		await p.step({ jump: true });
		expect(p.player().vy).toBeGreaterThan(vy);
		expect(p.player().vx).toBeLessThanOrEqual(-3);
	});
});

// Scrubbing back parks the player exactly where it was, then hands control
// over through the resume speed-stepper: a 7-frame ramp (RESUME_PHASE_FRAMES)
// on which the stepper, not the player, owns the velocity. A player scrubbed
// back onto a wall spends that ramp clinging, and everything about the wall
// jump has to survive it — the contact itself (a frozen player pushes into
// nothing, so no collision is reported), the 4-frame wall coyote, and the A
// press, which lands mid-ramp on a frame whose velocity is about to be
// overwritten.
describe("wall jump across a rewind", () => {
	// The player clings around a third of the way down, which is what the
	// depth is for at both ends: ~11 tiles below, so a 45-frame cling at
	// WALL_SLIDE_MAX_SPEED=4 never reaches the floor (landing would end the
	// cling for honest reasons and hide the bug), and ~7 tiles of headroom
	// above, since a wall-jump chain climbs ~100px and leaving the top of the
	// grid is a death.
	const SHAFT = level(`
		..#....#...ee.
		..#....#...Ee.
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#.P..#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..#....#......
		..............
		##############
	`);

	// Ride the right-hand wall, then scrub a few frames back and resume,
	// leaving the player clinging where it was.
	async function clingThenScrub() {
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isOnWall, {
			right: true,
			maxFrames: 90,
		});
		await p.hold(6, { right: true });
		await p.step({ pause: true });
		await p.step({ crank: 10 }); // ~5 frames back, still on the wall
		await p.step({ pause: true }); // B resumes
	}

	it("keeps the cling long after the resume with no input held", async () => {
		await clingThenScrub();

		// No direction held — which is how a player arrives here, with a hand
		// on the crank rather than the d-pad. The contact has to survive the
		// ramp AND everything after it: it used to drop on the first resumed
		// frame, and with the adhesion gated on isOnWall nothing could ever
		// win it back, so the wall jump was gone for the rest of the descent.
		// The 45 frames here is the point: the old bug only showed up after
		// the ramp and the wall coyote had both run out.
		for (let i = 0; i < 45; i++) {
			await p.step({});
			expect(p.obs.hints.canWallJump).toBe(true);
		}
		expect(p.player().isOnWall).toBe(true);
		expect(p.player().wallDirection).toBe(-1);
	});

	it("wall jumps on a press that comes well after the resume", async () => {
		await clingThenScrub();
		// A human doesn't press A on the resume frame; they watch the world
		// start moving and then jump. Every delay past the ramp used to be
		// dead input.
		await p.hold(30);

		const x = p.player().x;
		await p.hold(10, { jump: true });
		expect(p.player().vy).toBeLessThan(0);
		expect(p.player().vx).toBeLessThanOrEqual(-3);
		expect(p.player().x).toBeLessThan(x - 24);
	});

	it("fires an A press held from the first resumed frame", async () => {
		await clingThenScrub();
		const x = p.player().x;

		// The press lands during the ramp, where the physics would erase the
		// jump it started. It waits in the buffer instead and fires as a wall
		// jump on the first frame the player actually controls.
		// (The ramp eats the first few of those frames, so the travel below is
		// only the handful of pushed frames that follow it.)
		await p.hold(10, { jump: true });
		expect(p.player().vy).toBeLessThan(0);
		expect(p.player().vx).toBeLessThanOrEqual(-3);
		expect(p.player().x).toBeLessThan(x - 12);
	});

	it("chains on to the opposite wall", async () => {
		await clingThenScrub();
		await p.hold(12, { jump: true });

		// Cross the shaft and catch the far wall: the second wall jump has to
		// work like any other, pushing back the way it came.
		const caught = await p.runUntil((o) => o.player.isOnWall, {
			left: true,
			maxFrames: 90,
		});
		expect(caught).toBeGreaterThanOrEqual(0);
		expect(p.player().wallDirection).toBe(1);

		const x = p.player().x;
		await p.hold(10, { jump: true });
		expect(p.player().vx).toBeGreaterThanOrEqual(3);
		expect(p.player().x).toBeGreaterThan(x + 16);
	});

	it("buffers a ground jump across the ramp, and invents none", async () => {
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isGrounded, { maxFrames: 120 });
		await p.hold(4);
		await p.step({ pause: true });
		await p.step({ crank: 10 });
		await p.step({ pause: true });

		// Pressed on the first resumed frame, the jump still happens.
		const y = p.player().y;
		await p.hold(12, { jump: true });
		expect(p.player().y).toBeLessThan(y - 16);

		// And resuming with nothing held stays put: the buffered press from
		// the wound-back timeline must not fire a jump nobody asked for.
		await p.reset(SHAFT);
		await p.runUntil((o) => o.player.isGrounded, { maxFrames: 120 });
		await p.step({ jump: true }); // press, then immediately scrub it away
		await p.step({ pause: true });
		await p.step({ crank: 10 });
		await p.step({ pause: true });
		for (let i = 0; i < 8; i++) {
			await p.step({});
			expect(p.player().vy).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("speed boost", () => {
	// A long flat corridor: currentMaxSpeed only ramps past 8 after holding a
	// direction for SPEED_RAMP_TIME (=60) frames. Exit parked top-right, above
	// the ground the player runs along.
	const CORRIDOR = level(
		[
			".".repeat(58) + "ee",
			".".repeat(58) + "Ee",
			".P" + ".".repeat(58),
			"#".repeat(60),
		].join("\n"),
	);

	it("ramps currentMaxSpeed 8 -> 14 after a sustained hold, and stopping resets it", async () => {
		await p.reset(CORRIDOR);
		await settle();
		expect(p.player().currentMaxSpeed).toBe(8);

		// Hold right well past the 60-frame ramp start; it climbs +1/frame to
		// the 14 cap within ~6 frames of ramping.
		await p.hold(75, { right: true });
		expect(p.player().currentMaxSpeed).toBeGreaterThan(13);

		// Releasing (stopping) drops the cap straight back to the base 8.
		await p.step();
		expect(p.player().currentMaxSpeed).toBe(8);
	});
});

describe("left / right symmetry", () => {
	it("walks and jumps leftward onto a ledge exit", async () => {
		// Mirror of the rightward two-tile-rise jump: exit sits on a ledge to
		// the LEFT of spawn, behind a two-tile riser.
		await p.reset(
			level(`
				............
				ee..........
				Ee..........
				##..........
				##......P...
				############
			`),
		);
		const startX = p.player().x;

		await p.runUntil((o) => o.player.wallContactLeft, {
			left: true,
			maxFrames: 120,
		});
		await p.jump({ left: true, settle: 30 });

		expect(p.lifecycle()).toBe("LEVEL_COMPLETE");
		// The whole traversal was leftward.
		expect(startX).toBeGreaterThan(16);
	});

	it("left wins when both directions are held", async () => {
		await p.reset(
			level(`
				..................ee
				..................Ee
				.........P..........
				####################
			`),
		);
		await settle();

		await p.hold(6, { left: true, right: true });
		expect(p.player().vx).toBeLessThan(0);
		// direction 1 == LEFT (see player.lua LEFT/RIGHT locals).
		expect(p.player().direction).toBe(1);
	});
});

describe("ceiling bonk", () => {
	// A ceiling one tile above the player's headroom: a full-height jump must
	// bonk it rather than punch through or stick. Exit parked far right at
	// ground level, where the straight-up jump never reaches it.
	const CEILING = level(`
		############
		..........ee
		.P........Ee
		############
	`);

	it("a full jump into the ceiling is cancelled and the player drops back", async () => {
		await p.reset(CEILING);
		await settle();
		const groundY = p.player().y;

		// Hold a full-height jump straight up into the ceiling, tracking the
		// apex.
		let minY = groundY;
		for (let i = 0; i < 12; i++) {
			await p.step({ jump: true });
			minY = Math.min(minY, p.player().y);
		}

		// The ceiling capped the rise to ~1 tile even though this was a full
		// 12-frame hold (which clears ~2.8 tiles in the open) — upward velocity
		// was cancelled, not stored up.
		const rise = groundY - minY;
		expect(rise).toBeGreaterThan(4);
		expect(rise).toBeLessThan(28);

		// It did not stick to the ceiling: it falls back and lands, still alive.
		await p.runUntil((o) => o.player.isGrounded, { maxFrames: 60 });
		expect(p.player().isGrounded).toBe(true);
		expect(p.lifecycle()).toBe("PLAYING");
	});
});

describe("resume speed-stepper", () => {
	// Runway to build up speed, then a jump so the pause happens mid-air where
	// the resume stepper's phased velocity is observable. Exit parked top-right.
	const RUNWAY = level(
		[
			".".repeat(38) + "ee",
			".".repeat(38) + "Ee",
			".".repeat(40),
			".".repeat(40),
			".P" + ".".repeat(38),
			"#".repeat(40),
		].join("\n"),
	);

	it("velocity returns gradually after resuming mid-air", async () => {
		await p.reset(RUNWAY);
		await settle();

		// Build up horizontal speed, then jump and rise into the air.
		await p.hold(30, { right: true });
		await p.hold(4, { right: true, jump: true });
		expect(p.player().isGrounded).toBe(false);
		const prePauseVx = p.player().vx;
		expect(prePauseVx).toBeGreaterThan(4);

		// Pause (B), release B, then resume (B). The resume stepper feeds the
		// pre-pause velocity back in phases (2 frozen frames first).
		await p.step({ pause: true });
		expect(p.lifecycle()).toBe("PAUSED");
		await p.step();
		await p.step({ pause: true });
		expect(p.lifecycle()).toBe("PLAYING");

		// Right after resuming, vx is far below its pre-pause value (frozen
		// phase drives it to ~0).
		expect(Math.abs(p.player().vx)).toBeLessThan(prePauseVx / 2);
	});
});
