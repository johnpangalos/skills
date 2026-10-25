import "logic/level-source"

local function findLayer(map, name)
  for _, layer in ipairs(map.layers) do
    if layer.name == name then return layer end
  end
  return nil
end

local function tileAt(layer, col, row)
  return layer.data[(row - 1) * layer.width + col]
end

describe("LevelSource", function()
  describe("validation", function()
    it("rejects missing format", function()
      local map, err = LevelSource.transpile({ grid = { "P.E" } })
      assertNil(map)
      assertNotNil(err)
    end)

    it("rejects unknown format", function()
      local map, err = LevelSource.transpile({ format = "v999", grid = { "P.E" } })
      assertNil(map)
      assertNotNil(err)
    end)

    it("rejects empty grid", function()
      local map, err = LevelSource.transpile({ format = "ascii-v1", grid = {} })
      assertNil(map)
      assertNotNil(err)
    end)

    it("requires exactly one P", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "...", ".E.", "..." },
      })
      assertNotNil(err)
    end)

    it("rejects two Ps", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.P", ".E.", "..." },
      })
      assertNotNil(err)
    end)

    it("requires exactly one E", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P..", "...", "..." },
      })
      assertNotNil(err)
    end)

    it("rejects switch char with no declaration", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E", "..1", "..." },
      })
      assertNotNil(err)
    end)

    it("rejects switch declared but not placed", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E", "...", "..." },
        switches = { { id = "1" } },
      })
      assertNotNil(err)
    end)
  end)

  describe("trivial 3x3 box", function()
    local map
    before_each(function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "###",
          "PE.",
          "###",
        },
      })
      assertNil(err)
      map = m
    end)

    it("has correct dimensions", function()
      assertEquals(map.width, 3)
      assertEquals(map.height, 3)
      assertEquals(map.tilewidth, 16)
      assertEquals(map.tileheight, 16)
    end)

    it("places player center at (8, 24) for cell (1, 2)", function()
      local layer = findLayer(map, "player-obj")
      assertNotNil(layer)
      assertEquals(layer.objects[1].x, 8)
      assertEquals(layer.objects[1].y, 24)
    end)

    it("places exit-obj so sprite center is at top-right of E cell", function()
      -- E is at (col=2, row=2). The exit is 32x32, with E as its bottom-left
      -- corner.
      -- exitObjX = col*16 = 32. exitObjY = row*16 = 32.
      -- level.lua applies (x, y-16), so the sprite center is (32, 16).
      local layer = findLayer(map, "exit-obj")
      assertNotNil(layer)
      local cx = layer.objects[1].x
      local cy = layer.objects[1].y - 16
      assertEquals(cx, 32)
      assertEquals(cy, 16)
    end)

    it("emits walls layer with non-zero data on top and bottom rows", function()
      local layer = findLayer(map, "walls")
      assertNotNil(layer)
      assertTrue(tileAt(layer, 1, 1) ~= 0)
      assertTrue(tileAt(layer, 2, 1) ~= 0)
      assertTrue(tileAt(layer, 3, 1) ~= 0)
      assertTrue(tileAt(layer, 1, 2) == 0)
      assertTrue(tileAt(layer, 1, 3) ~= 0)
    end)
  end)

  describe("autotile correctness on a 5x5 box", function()
    local layer
    before_each(function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "#####",
          "#...#",
          "#.P.#",
          "#.E.#",
          "#####",
        },
      })
      assertNil(err)
      layer = findLayer(map, "walls")
      assertNotNil(layer)
    end)

    it("top-left corner uses world-one tile 0 (GID 1)", function()
      -- wangid for (1,1): N=empty, W=empty, E=wall, S=wall, SE=wall,
      -- others empty
      -- → "00111000" → tileid 0 → GID 1
      assertEquals(tileAt(layer, 1, 1), 1)
    end)

    it("top edge middle uses world-one tile 1 (GID 2)", function()
      -- wangid for (3,1): N=out of bounds (empty), E=wall, S=empty, W=wall.
      -- N (col=3, row=0): out of bounds, so empty (false).
      -- E (col=4, row=1): a wall, so true.
      -- S (col=3, row=2): empty, so false.
      -- W (col=2, row=1): a wall, so true.
      -- TR = N and E and NE = false.
      -- BR = S and E and SE = false.
      -- BL = S and W and SW = false.
      -- TL = N and W and NW = false.
      -- wangid = T(0) TR(0) R(1) BR(0) B(0) BL(0) L(1) TL(0) = "00100010".
      -- This maps to tile 19, GID 20.
      assertEquals(tileAt(layer, 3, 1), 20)
    end)

    it("middle interior cells are empty (not walls)", function()
      assertEquals(tileAt(layer, 2, 2), 0)
      assertEquals(tileAt(layer, 3, 2), 0)
      assertEquals(tileAt(layer, 4, 2), 0)
    end)
  end)

  describe("autotile one-thick walls", function()
    it("vertical run and caps use edge-drawn tiles, not the interior fallback", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P#..",
          ".#..",
          ".#.E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "walls")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 2, 1), 17) -- top cap: wall below only -> tile 16
      assertEquals(tileAt(layer, 2, 2), 10) -- vertical middle -> tile 9
      assertEquals(tileAt(layer, 2, 3), 11) -- bottom cap: wall above only -> tile 10
    end)

    it("an isolated block uses the isolated tile", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.#.E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "walls")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 3, 1), 22) -- isolated -> tile 21
    end)
  end)

  describe("lasers", function()
    it("emits direction GIDs 12-15 for >, <, v, ^", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P>...",
          ".....",
          "v.^.<",
          ".....",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "lasers")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 2, 1), 12) -- >
      assertEquals(tileAt(layer, 1, 3), 14) -- v
      assertEquals(tileAt(layer, 3, 3), 15) -- ^
      assertEquals(tileAt(layer, 5, 3), 13) -- <
    end)

    it("emits moving-laser GIDs 16-19 for }, {, ], [", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P}...",
          ".....",
          "].[.{",
          ".....",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "lasers")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 2, 1), 16) -- }
      assertEquals(tileAt(layer, 1, 3), 18) -- ]
      assertEquals(tileAt(layer, 3, 3), 19) -- [
      assertEquals(tileAt(layer, 5, 3), 17) -- {
    end)

    it("omits lasers layer entirely when no emitters present", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertNil(findLayer(map, "lasers"))
    end)

    it("attaches per-emitter timing keyed by data index", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P>...",
          "....v",
          "....E",
        },
        lasers = {
          { at = { 2, 1 }, active = 45, idle = 15, offset = 10 },
        },
      })
      assertNil(err)
      local layer = findLayer(map, "lasers")
      assertNotNil(layer)
      local timing = layer.properties.laserTiming
      assertNotNil(timing)
      -- (row-1)*width+col = 0*5+2
      assertEquals(timing[2].warning, 30) -- default fills unset fields
      assertEquals(timing[2].active, 45)
      assertEquals(timing[2].idle, 15)
      assertEquals(timing[2].offset, 10)
      -- Unconfigured emitter (the 'v') gets no entry: runtime defaults apply.
      assertNil(timing[1 * 5 + 5])
    end)

    it("omits layer properties when no lasers config given", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
      })
      assertNil(err)
      local layer = findLayer(map, "lasers")
      assertNotNil(layer)
      assertNil(layer.properties)
    end)

    it("rejects config whose at is not a laser emitter", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
        lasers = { { at = { 1, 1 } } },
      })
      assertNil(map)
      assertEquals(
        err,
        "lasers[1].at [1, 1] does not point at a laser emitter"
      )
    end)

    it("rejects duplicate config for the same emitter", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
        lasers = { { at = { 2, 1 } }, { at = { 2, 1 }, active = 10 } },
      })
      assertNil(map)
      assertEquals(
        err,
        "lasers[2] duplicates config for emitter at [2, 1]"
      )
    end)

    it("rejects non-integer or out-of-range durations", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
        lasers = { { at = { 2, 1 }, active = 0 } },
      })
      assertNil(map)
      assertEquals(err, "lasers[1].active must be an integer >= 1 (frames)")

      map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
        lasers = { { at = { 2, 1 }, offset = -5 } },
      })
      assertNil(map)
      assertEquals(err, "lasers[1].offset must be an integer >= 0 (frames)")
    end)

    it("passes a mover's patrol speed through, fractional allowed", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P}...",
          "....}",
          "....E",
        },
        lasers = {
          { at = { 2, 1 }, speed = 0.5 },
        },
      })
      assertNil(err)
      local timing = findLayer(map, "lasers").properties.laserTiming
      assertEquals(timing[2].speed, 0.5)
      -- Unset on a configured mover falls back to the 1px/frame default.
      assertNil(timing[1 * 5 + 5])
    end)

    it("rejects speed on a static emitter", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P>.E" },
        lasers = { { at = { 2, 1 }, speed = 2 } },
      })
      assertNil(map)
      assertEquals(
        err,
        "lasers[1].speed only applies to a moving laser emitter (} { ] [)"
      )
    end)

    it("rejects speed of zero or above the half-tile cap", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P}.E" },
        lasers = { { at = { 2, 1 }, speed = 0 } },
      })
      assertNil(map)
      assertEquals(
        err,
        "lasers[1].speed must be a number > 0 and <= 8 (pixels per frame)"
      )

      map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P}.E" },
        lasers = { { at = { 2, 1 }, speed = 9 } },
      })
      assertNil(map)
      assertEquals(
        err,
        "lasers[1].speed must be a number > 0 and <= 8 (pixels per frame)"
      )
    end)
  end)

  describe("platforms", function()
    it("emits left/mid/right tiles for a 3-cell run", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.....",
          "..===.",
          ".....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "platforms")
      assertNotNil(layer)
      -- platform at row 2 cols 3-5
      assertEquals(tileAt(layer, 3, 2), 25) -- LEFT (firstgid 25 + 0)
      assertEquals(tileAt(layer, 4, 2), 26) -- MID
      assertEquals(tileAt(layer, 5, 2), 27) -- RIGHT
      assertEquals(tileAt(layer, 2, 2), 0)
      assertEquals(tileAt(layer, 6, 2), 0)
    end)

    it("emits a single mid tile for a 1-cell platform", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P....",
          "..=..",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "platforms")
      assertEquals(tileAt(layer, 3, 2), 26)
    end)
  end)

  describe("conveyor belts", function()
    it("groups a row of the same glyph into one run", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P...))...E",
          "####################",
          "..........",
          ".((.......",
          "####################",
        },
      })
      assertNil(err)
      local layer = findLayer(m, "belts")
      assertNotNil(layer)
      -- Sorted by leftmost tile: the row-1 run comes before the row-3 one.
      local runs = layer.properties.runs
      assertEquals(#runs, 2)
      assertEquals(runs[1].col, 5)
      assertEquals(runs[1].row, 1)
      assertEquals(runs[1].length, 2)
      assertEquals(runs[1].direction, 1)
      assertEquals(runs[1].mount, "floor")
      assertEquals(runs[2].col, 2)
      assertEquals(runs[2].row, 4)
      assertEquals(runs[2].length, 2)
      assertEquals(runs[2].direction, -1)
    end)

    it("splits a run where the glyph changes direction", function()
      -- One collider and one strip of art per run, so a belt that carries
      -- two ways is two belts that happen to touch.
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P..))((..E",
          "####################",
        },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      assertEquals(#runs, 2)
      assertEquals(runs[1].direction, 1)
      assertEquals(runs[1].length, 2)
      assertEquals(runs[2].col, 6)
      assertEquals(runs[2].direction, -1)
      assertEquals(runs[2].length, 2)
    end)

    it("reads the mount off the wall the belt sits against", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "####################",
          "P..))....E",
          "..........",
          "..))......",
          "####################",
        },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      assertEquals(#runs, 2)
      assertEquals(runs[1].mount, "ceiling")
      assertEquals(runs[2].mount, "floor")
    end)

    it("keeps a belt out of the static terrain layers", function()
      -- A belt is drawn by conveyor.lua, from its own tileset. It must not
      -- also be baked into the image the static terrain blits.
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.)).E",
          "######",
        },
      })
      assertNil(err)
      assertNil(findLayer(m, "platforms"))
      local walls = findLayer(m, "walls")
      assertNotNil(walls)
      assertEquals(tileAt(walls, 3, 1), 0)
      assertEquals(tileAt(walls, 4, 1), 0)
    end)

    it("marks the belt cells in the layer data", function()
      -- level.lua stamps these cells into the terrain grid, so a beam stops
      -- at a belt and a guard patrols across one.
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.)).E",
          "######",
        },
      })
      assertNil(err)
      local layer = findLayer(m, "belts")
      assertTrue(tileAt(layer, 3, 1) ~= 0)
      assertTrue(tileAt(layer, 4, 1) ~= 0)
      assertEquals(tileAt(layer, 5, 1), 0)
    end)

    it("rejects a belt that is mounted on nothing", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P..))....E" },
      })
      assertNil(m)
      assertTrue(err:find("mounted on a wall") ~= nil, err)
    end)

    it("rejects a belt that is walled in above and below", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "####################",
          "P..))....E",
          "####################",
        },
      })
      assertNil(m)
      assertTrue(err:find("walled in") ~= nil, err)
    end)

    it("applies a belts entry to the run its `at` names", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P..))....E",
          "####################",
        },
        belts = { { at = { 4, 1 }, speed = 2.5 } },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      assertEquals(runs[1].speed, 2.5)
    end)

    it("rejects an `at` that names no run", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P..))....E",
          "####################",
        },
        belts = { { at = { 9, 1 } } },
      })
      assertNil(m)
      assertTrue(err:find("not the first tile") ~= nil, err)
    end)

    it("rejects a speed outside the authorable range", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P..))....E",
          "####################",
        },
        belts = { { at = { 4, 1 }, speed = 13 } },
      })
      assertNil(m)
      assertTrue(err:find("speed") ~= nil, err)
    end)

    it("groups a column of the same glyph into one run", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P........E",
          "..#'......",
          "..#'......",
          "..#,......",
          "##########",
        },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      -- The direction change splits the column, the same as it splits a row.
      assertEquals(#runs, 2)
      assertEquals(runs[1].col, 4)
      assertEquals(runs[1].row, 2)
      assertEquals(runs[1].length, 2)
      assertEquals(runs[1].axis, "y")
      assertEquals(runs[1].direction, -1)
      assertEquals(runs[1].mount, "right")
      assertEquals(runs[2].row, 4)
      assertEquals(runs[2].length, 1)
      assertEquals(runs[2].direction, 1)
    end)

    it("reads a column belt's mount off the wall beside it", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P........E",
          "..#'.,#...",
          "..#'.,#...",
          "##########",
        },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      assertEquals(#runs, 2)
      -- A wall on the left leaves the right face open, and the other way
      -- round.
      assertEquals(runs[1].col, 4)
      assertEquals(runs[1].mount, "right")
      assertEquals(runs[2].col, 6)
      assertEquals(runs[2].mount, "left")
    end)

    it("keeps a row run and a column run apart in the same grid", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P........E",
          "..#'......",
          "..#'......",
          "..#))#....",
          "..####....",
          "##########",
        },
      })
      assertNil(err)
      local runs = findLayer(m, "belts").properties.runs
      assertEquals(#runs, 2)
      assertEquals(runs[1].axis, "y")
      assertEquals(runs[1].length, 2)
      assertEquals(runs[2].axis, "x")
      assertEquals(runs[2].col, 4)
      assertEquals(runs[2].row, 4)
      assertEquals(runs[2].length, 2)
    end)

    it("rejects a column belt mounted on nothing", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P........E",
          "....'.....",
          "##########",
        },
      })
      assertNil(m)
      assertTrue(err:find("left or right of it") ~= nil, err)
    end)

    it("rejects a column belt walled in on both sides", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P........E",
          "..#'#.....",
          "##########",
        },
      })
      assertNil(m)
      assertTrue(err:find("walled in") ~= nil, err)
    end)

    it("joins a belt to the wall it is mounted on", function()
      -- The autotiler counts a belt as terrain, so the wall under a run
      -- draws no air-facing border where the two meet and the belt sits
      -- flush in the level's silhouette.
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.))..E",
          "#######",
        },
      })
      assertNil(err)
      local walls = findLayer(m, "walls")
      -- The cell under a belt connects north; the one under open air does
      -- not, so the two wall tiles differ.
      assertTrue(tileAt(walls, 3, 2) ~= tileAt(walls, 6, 2))
    end)
  end)

  describe("switches", function()
    local map
    before_each(function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P...1...E",
          ".........",
          ".........",
        },
        switches = {
          { id = "1", blockingWalls = { { 6, 2 }, { 7, 2 } } },
        },
      })
      assertNil(err)
      map = m
    end)

    it("emits switch-1 object layer at the cell with '1'", function()
      local layer = findLayer(map, "switch-1")
      assertNotNil(layer)
      assertEquals(layer.type, "objectgroup")
      assertEquals(layer.objects[1].x, 4 * 16 + 8) -- col 5 → (5-1)*16 + 8 = 72
      assertEquals(layer.objects[1].y, 0 * 16 + 8) -- row 1 → 8
    end)

    it("emits blocking-walls-1 with non-zero tiles at the listed coords", function()
      local layer = findLayer(map, "blocking-walls-1")
      assertNotNil(layer)
      assertTrue(tileAt(layer, 6, 2) ~= 0)
      assertTrue(tileAt(layer, 7, 2) ~= 0)
      assertEquals(tileAt(layer, 5, 2), 0)
    end)

    it("emits no belts layer for a switch", function()
      -- A belt answers to no switch. It comes from the grid glyphs instead.
      assertNil(findLayer(map, "belts"))
    end)

    it("omits blocking-walls-N if list is empty", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.1.E" },
        switches = { { id = "1", gravity = true, blockingWalls = {} } },
      })
      assertNil(err)
      assertNil(findLayer(m, "blocking-walls-1"))
    end)
  end)

  describe("gravity switches", function()
    it("accepts a placed switch whose only effect is gravity", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.g.E" },
        switches = { { id = "g", gravity = true } },
      })
      assertNil(err)
      assertNotNil(m)
    end)

    it("tags the switch object layer with properties.gravity", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.g.E" },
        switches = { { id = "g", gravity = true } },
      })
      assertNil(err)
      local layer = findLayer(m, "switch-g")
      assertNotNil(layer)
      assertNotNil(layer.properties)
      assertTrue(layer.properties.gravity == true)
    end)

    it("leaves non-gravity switch layers untagged", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.1.E" },
        switches = { { id = "1", blockingWalls = { { 4, 1 } } } },
      })
      assertNil(err)
      local layer = findLayer(m, "switch-1")
      assertNotNil(layer)
      assertNil(layer.properties)
    end)

    it("still rejects a placed switch declaring gravity = false with no other effect", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.g.E" },
        switches = { { id = "g", gravity = false } },
      })
      assertNotNil(err)
    end)

    it("rejects a non-boolean gravity field", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.g.E" },
        switches = { { id = "g", gravity = "yes" } },
      })
      assertNotNil(err)
    end)

    it("combines gravity with blocking walls on one switch", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P...g...E",
          "....GG...",
        },
        switches = { { id = "g", gravity = true } },
      })
      assertNil(err)
      assertNotNil(findLayer(m, "blocking-walls-g"))
      local layer = findLayer(m, "switch-g")
      assertNotNil(layer)
      assertTrue(layer.properties.gravity == true)
    end)
  end)

  describe("off-blocks", function()
    it("emits blocking-walls-off-a from '!' tiles", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P...a...E",
          "....!!!..",
          ".........",
        },
      })
      assertNil(err)
      local layer = findLayer(m, "blocking-walls-off-a")
      assertNotNil(layer)
      assertTrue(tileAt(layer, 5, 2) ~= 0)
      assertTrue(tileAt(layer, 6, 2) ~= 0)
      assertTrue(tileAt(layer, 7, 2) ~= 0)
      assertEquals(tileAt(layer, 4, 2), 0)
    end)

    it("emits both on- and off-block layers for the same switch", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.b.E",
          "B...@",
        },
      })
      assertNil(err)
      assertNotNil(findLayer(m, "blocking-walls-b"))
      assertNotNil(findLayer(m, "blocking-walls-off-b"))
    end)

    it("rejects off-block when matching switch is not placed", function()
      local _, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.!.E" },
      })
      assertNotNil(err)
    end)

    it("emits switch-c object layer when only off-blocks reference it", function()
      local m, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.c.E",
          "..$..",
        },
      })
      assertNil(err)
      assertNotNil(findLayer(m, "switch-c"))
      assertNotNil(findLayer(m, "blocking-walls-off-c"))
    end)
  end)

  describe("spikes", function()
    it("emits spikes layer with non-zero tile at each * cell", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P....",
          "..*.*",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "spikes")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 1, 2), 0)
      assertEquals(tileAt(layer, 2, 2), 0)
      assertTrue(tileAt(layer, 3, 2) ~= 0)
      assertEquals(tileAt(layer, 4, 2), 0)
      assertTrue(tileAt(layer, 5, 2) ~= 0)
    end)

    it("omits spikes layer entirely when no * present", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertNil(findLayer(map, "spikes"))
    end)

    it("does not treat * as a switch character", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.*E" },
      })
      assertNil(err)
      assertNotNil(map)
    end)
  end)

  describe("enemies", function()
    it("emits enemies-obj layer with a point at each & cell center", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.&.&",
          "#####",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "enemies-obj")
      assertNotNil(layer)
      assertEquals(layer.type, "objectgroup")
      assertEquals(#layer.objects, 2)
      assertEquals(layer.objects[1].x, 2 * 16 + 8, "first x")
      assertEquals(layer.objects[1].y, 8, "first y")
      assertEquals(layer.objects[2].x, 4 * 16 + 8, "second x")
      assertEquals(layer.objects[2].y, 8, "second y")
    end)

    it("omits enemies-obj layer entirely when no & present", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertNil(findLayer(map, "enemies-obj"))
    end)

    it("does not treat & as a switch or wall character", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P&E" },
      })
      assertNil(err)
      assertNotNil(map)
      local walls = findLayer(map, "walls")
      assertEquals(tileAt(walls, 2, 1), 0)
    end)
  end)

  describe("pulse orbs", function()
    it("emits pulses-obj layer with a point at each + cell center", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P.+.+",
          "#####",
          "....E",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "pulses-obj")
      assertNotNil(layer)
      assertEquals(layer.type, "objectgroup")
      assertEquals(#layer.objects, 2)
      assertEquals(layer.objects[1].x, 2 * 16 + 8, "first x")
      assertEquals(layer.objects[1].y, 8, "first y")
      assertEquals(layer.objects[2].x, 4 * 16 + 8, "second x")
      assertEquals(layer.objects[2].y, 8, "second y")
    end)

    it("omits pulses-obj layer entirely when no + present", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertNil(findLayer(map, "pulses-obj"))
    end)

    it("does not treat + as a switch or wall character", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P+E" },
      })
      assertNil(err)
      assertNotNil(map)
      local walls = findLayer(map, "walls")
      assertEquals(tileAt(walls, 2, 1), 0)
    end)
  end)

  describe("crumbles", function()
    it("emits crumbles layer with non-zero tile at each ~ cell", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = {
          "P....",
          ".~~.E",
          "#####",
        },
      })
      assertNil(err)
      local layer = findLayer(map, "crumbles")
      assertNotNil(layer)
      assertEquals(tileAt(layer, 1, 2), 0)
      assertTrue(tileAt(layer, 2, 2) ~= 0)
      assertTrue(tileAt(layer, 3, 2) ~= 0)
      assertEquals(tileAt(layer, 4, 2), 0)
    end)

    it("omits crumbles layer entirely when no ~ present", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertNil(findLayer(map, "crumbles"))
    end)

    it("does not treat ~ as a switch or wall character", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P~E" },
      })
      assertNil(err)
      assertNotNil(map)
      local walls = findLayer(map, "walls")
      assertEquals(tileAt(walls, 2, 1), 0)
    end)
  end)

  describe("tilesets", function()
    it("emits world-one as firstgid=1 and level-base as firstgid=25", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        grid = { "P.E" },
      })
      assertNil(err)
      assertEquals(#map.tilesets, 2)
      assertEquals(map.tilesets[1].firstgid, 1)
      assertEquals(map.tilesets[1].name, "world-one-table-16-16")
      assertEquals(map.tilesets[2].firstgid, 25)
      assertEquals(map.tilesets[2].name, "level-base-table-16-16")
    end)
  end)

  describe("tileset", function()
    it("carries the tileset name into the map properties", function()
      local map = LevelSource.transpile({
        format = "ascii-v1",
        tileset = "world-two",
        grid = { "P.E" },
      })
      assertEquals(map.properties.tileset, "world-two")
    end)

    it("leaves the tileset unset when the source names none", function()
      local map = LevelSource.transpile({ format = "ascii-v1", grid = { "P.E" } })
      assertNil(map.properties.tileset)
    end)

    it("rejects a tileset that is not a string", function()
      local map, err = LevelSource.transpile({
        format = "ascii-v1",
        tileset = 2,
        grid = { "P.E" },
      })
      assertNil(map)
      assertNotNil(err)
    end)
  end)
end)
