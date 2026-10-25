import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Playtest, level } from "../src/playtest";

let p: Playtest;

beforeAll(() => {
	p = new Playtest();
});

afterAll(async () => {
	await p.close();
});

async function settle() {
	await p.runUntil((o) => o.player.isGrounded, { maxFrames: 90 });
}

describe("camera look-ahead", () => {
	// A long flat runway (60 tiles = 960px) so the camera has room to
	// scroll without hitting the level-bound clamp. Exit parked far right,
	// out of reach of the 60-frame run.
	const RUNWAY = level(`
		............................................................
		............................................................
		............................................................
		.........................................................ee.
		.P........................................................Ee
		############################################################
	`);

	it("keeps a running player behind screen center, showing more ahead", async () => {
		await p.reset(RUNWAY);
		await settle();
		// Run right long enough for the smoothed lead (~48px at full speed)
		// and the camera lerp to converge.
		const obs = await p.hold(60, { right: true });
		expect(obs.player.vx).toBeGreaterThan(7);

		const screenX = obs.player.x + obs.camera.offsetX;
		// Without look-ahead the dead zone anchors a right-runner at screen
		// x=240 plus ~24px of lerp lag (~264). With the lead the anchor
		// slides to ~192, so the player sits left of center.
		expect(screenX).toBeLessThan(235);
		// Sanity: still on screen, not overshot.
		expect(screenX).toBeGreaterThan(100);
	});

	it("leads toward the jump-off side while wall-clinging", async () => {
		// A free-standing tall column mid-level (the world-two-05 guard
		// tower situation): the player steps off its top and clings to the
		// right face. Velocity is zero on the wall, but the only way off is
		// a jump to the right — the camera should pan to show that side.
		const TOWER = level(`
			........................................
			....................P...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...................
			....................#...............ee..
			....................#...............Ee..
			########################################
		`);
		await p.reset(TOWER);
		await settle();
		// Step off the top to the right, then press back into the column.
		await p.runUntil((o) => !o.player.isGrounded, {
			right: true,
			maxFrames: 30,
		});
		await p.runUntil((o) => o.player.isOnWall, { left: true, maxFrames: 30 });
		// Ride the slide while the smoothed lead converges.
		const obs = await p.hold(30, { left: true });
		expect(obs.player.isOnWall).toBe(true);

		const screenX = obs.player.x + obs.camera.offsetX;
		// The wall lead anchors the clinger at screen x ~160 (240px of view
		// toward the jump); without it they'd park right of center (~216).
		expect(screenX).toBeLessThan(175);
		expect(screenX).toBeGreaterThan(145);
	});

	it("leads downward during a long fall", async () => {
		// A ~40-tile drop (the world-one-09 "fall down the left side"
		// situation). Once fall speed passes the deadband the box slides
		// up, so the faller rides high on screen and sees the ground
		// coming instead of hugging the bottom.
		const rows: string[] = [];
		rows.push(".P...........ee");
		rows.push("##...........Ee");
		for (let r = 0; r < 40; r++) rows.push("...............");
		rows.push("###############");
		await p.reset(level(rows.join("\n")));
		await settle();
		// Walk off the ledge, then free-fall.
		await p.runUntil((o) => !o.player.isGrounded && o.player.vy > 0, {
			right: true,
			maxFrames: 60,
		});
		// 45 frames in: at terminal velocity with the lead converged, still
		// ~11 tiles above the floor.
		const obs = await p.hold(45);
		expect(obs.player.isGrounded).toBe(false);
		expect(obs.player.vy).toBeGreaterThan(11.5);

		const screenY = obs.player.y + obs.camera.offsetY;
		// Steady state ≈ box bottom (90) + lerp lag (36); without the lead
		// the faller would sit at ~186.
		expect(screenY).toBeLessThan(150);
		expect(screenY).toBeGreaterThan(90);
	});
});
