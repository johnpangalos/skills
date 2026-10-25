"""Write placeholder character sheets into a playdate-game-01 checkout.

The real player.json and guard.json are hand-drawn and live in a private R2 bucket.
player-gen.lua and enemy.lua assert on their shape at import (frame count, cell size,
mouth patterns), and collision never reads the art, so a plain silhouette of the right
shape is enough for the unit specs, headless checks and playtests.

    python3 placeholder_art.py <repo>
"""

import json
import pathlib
import sys


def body(size=16):
    rows = []
    for y in range(size):
        if y < 2:
            rows.append("." * size)
        else:
            rows.append("..##" + "#" * (size - 8) + "##..")
    return rows


def main(repo):
    art = pathlib.Path(repo) / "src" / "art"
    art.mkdir(parents=True, exist_ok=True)
    mouths = {
        "oh": [".#.", "#.#", ".#."],
        "shout": ["###", "#.#", "###"],
        "grip": ["###"],
        "flat": ["##"],
    }
    player = {
        "format": "pixel-v1",
        "size": 16,
        "legend": ". transparent, # black, o white",
        "frames": [{"name": f"frame-{i + 1}", "rows": body()} for i in range(10)],
        "mouths": mouths,
    }
    guard = {
        "format": "pixel-v1",
        "size": 16,
        "legend": ". transparent, # black, o white",
        "frames": [{"name": f"walk-{i + 1}", "rows": body()} for i in range(2)],
    }
    (art / "player.json").write_text(json.dumps(player, indent=1))
    (art / "guard.json").write_text(json.dumps(guard, indent=1))


if __name__ == "__main__":
    main(sys.argv[1])
