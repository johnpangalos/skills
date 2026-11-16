// Returns one or more nodes as the text of an export file (<exports>/<name>.json): where each one
// sits, and the exact values it is drawn with. Read-only: it changes nothing in Figma. Run it
// with the Figma MCP (`node scripts/print.ts export-node 1:91` prints the code for `use_figma`)
// and save the result exactly as returned.
//
// Components. One id that is a component set gives one entry per variant, keyed by the variant's
// name. Several ids (`export-node 18:13 18:14 18:23`) give entries keyed `<node name>/<variant>`
// for sets and `<node name>` for the rest. A node that lays out two or more children also gets
// `layout` (direction, gap, padding and, with a stroke, whether the stroke is in the layout) and
// an entry per child, keyed `<parent> > <label or name>` with its position inside the parent.
//
// Pages. An id that is a frame (not a component) is a page, or part of one, built from
// instances: every frame under it gets an entry, all the way down, and so does every text node,
// with its type. A group gets no entry of its own: its children are walked as children of the
// entry above it, and Figma reports a group's children's x and y relative to the nearest frame,
// which is that entry, so they hold. Any other container with children is walked the same way
// (a section can't sit inside a frame, so a page has none). An instance of a library component gets one entry, its box, and nothing inside
// it: the component is the design system's to measure. An instance of a component made in this
// file (`local: true`) is opened like a frame, since the app builds it. Each entry names its
// `parent` entry, and its x and y are inside that parent. A frame's `label` is null here, because
// its text has entries of its own.
//
// What a box records: its size and position, `fill`, `stroke` and `strokeWeight` (a number, or
// top, right, bottom, left when the sides differ), `strokeAlign` and `dashed` (with a stroke only),
// `radius` (a number, or top-left, top-right, bottom-right, bottom-left when the corners differ),
// `rings` (drop shadows with no blur and no offset, a focus ring: colour and spread), `shadows`
// (every other visible shadow, an inset ring included: x, y, blur, spread, colour, inset), `opacity`, `sizing` (hug, fill or fixed, across then down),
// and `minWidth`/`maxWidth`/`minHeight`/`maxHeight` where set. Colours are "#rrggbb", or
// "#rrggbbaa" when see-through. `layout` (two or more laid-out children) adds `justify` and `align`
// in CSS's words, left out where a child fills that axis, and `wrap` with `rowGap` when it wraps.
// `label` (a component's first text) and a page's text entries carry the type: `fontFamily`,
// `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing` (px), `textCase`, `textDecoration`, and
// `textAlign` where the text has a set width. `tokens`, where anything is bound to a variable or
// style, names them: a variable by its web code syntax, a style by its name.
//
// Every entry has the node's `id`. Keys are unique: a repeated key is numbered (`Row`,
// `Row (2)`), since a JSON object keeps only the last of two equal keys and the first would go
// unmeasured.
//
// The last line is a hash of everything above it, which the tests check, so a copy that lost
// or changed a character fails instead of quietly testing against the wrong numbers.
export default async function exportNode(...nodeIds: string[]): Promise<string> {
  // Figma stores numbers as 32-bit floats (0.35 reads back as 0.3499999940…): round what is computed.
  const round = (value: number) => Math.round(value * 100) / 100;
  // "#rrggbb", or "#rrggbbaa" when the colour is see-through (a paint's opacity, a colour's alpha).
  // The alpha byte is printed only when it isn't 255 once rounded, so 0.999 is "#ffffff", not "#ffffffff".
  const hex = ({ r, g, b }: RGB, alpha = 1) => {
    const byte = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
    return "#" + [r, g, b].map(byte).join("") + (Math.round(alpha * 255) < 255 ? byte(alpha) : "");
  };
  const firstSolid = (paints: readonly Paint[] | typeof figma.mixed) =>
    Array.isArray(paints) ? paints.find((p): p is SolidPaint => p.type === "SOLID" && p.visible !== false) : undefined;
  const solid = (paints: readonly Paint[] | typeof figma.mixed) => {
    const paint = firstSolid(paints);
    return paint ? hex(paint.color, paint.opacity ?? 1) : null;
  };
  // Figma reports `figma.mixed` (a symbol) when a value differs within the node.
  const single = <T>(value: T | typeof figma.mixed) => (typeof value === "symbol" ? null : (value as T));
  const pixels = (lineHeight: LineHeight | typeof figma.mixed) => {
    const value = single(lineHeight);
    return value?.unit === "PIXELS" ? value.value : null;
  };
  // Letter spacing in pixels, as CSS computes it: Figma's percent is of the font size.
  const tracking = (node: TextNode) => {
    const value = single(node.letterSpacing);
    const size = single(node.fontSize);
    if (!value) return null;
    if (value.unit === "PIXELS") return round(value.value);
    return size === null ? null : round((value.value / 100) * size);
  };
  // Text properties in the words CSS uses for them, so a test compares them with getComputedStyle.
  // Figma's word → CSS's; null for a value that is mixed, or one with no CSS word.
  const css = (words: Record<string, string>, value: string | typeof figma.mixed) =>
    (typeof value === "string" && words[value]) || null;
  const textCase = (value: TextCase | typeof figma.mixed) =>
    css({ ORIGINAL: "none", UPPER: "uppercase", LOWER: "lowercase", TITLE: "capitalize", SMALL_CAPS: "small-caps", SMALL_CAPS_FORCED: "small-caps" }, value);
  const textDecoration = (value: TextDecoration | typeof figma.mixed) =>
    css({ NONE: "none", UNDERLINE: "underline", STRIKETHROUGH: "line-through" }, value);
  const textAlign = (node: TextNode) =>
    css({ LEFT: "left", CENTER: "center", RIGHT: "right", JUSTIFIED: "justify" }, node.textAlignHorizontal);
  // A text's type, for a component's label and for a text on a page. Alignment only matters, and
  // is only recorded, when the text wraps to a set width: a box that hugs its text has no room to align in.
  const typeOf = (node: TextNode) => ({
    fontFamily: single(node.fontName)?.family ?? null,
    fontSize: single(node.fontSize),
    fontWeight: single(node.fontWeight),
    lineHeight: pixels(node.lineHeight),
    letterSpacing: tracking(node),
    textCase: textCase(node.textCase),
    textDecoration: textDecoration(node.textDecoration),
    ...(node.textAutoResize !== "WIDTH_AND_HEIGHT" && { textAlign: textAlign(node) }),
  });

  // The names of the variables and styles a node's values come from: a variable by its WEB code
  // syntax (`var(--color-blue-600)`, what the Tailwind utility is read from), or its name where it
  // has none; a style by its name (`text-sm/medium`, `shadow-md`). Only what is bound is listed.
  const variables = new Map<string, string | null>();
  const variableName = async (alias: VariableAlias | readonly VariableAlias[] | undefined): Promise<string | null> => {
    const aliases = ([] as VariableAlias[]).concat((alias ?? []) as VariableAlias | VariableAlias[]);
    // A text's bound values are per run of characters: one name only when every run shares it.
    if (aliases.length === 0 || aliases.some((a) => a.id !== aliases[0]!.id)) return null;
    const id = aliases[0]!.id;
    if (!variables.has(id)) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      variables.set(id, variable ? (variable.codeSyntax.WEB ?? variable.name) : null);
    }
    return variables.get(id)!;
  };
  const styleName = async (id: string | typeof figma.mixed) =>
    typeof id === "string" && id !== "" ? ((await figma.getStyleByIdAsync(id))?.name ?? null) : null;
  const paintToken = async (node: SceneNode & MinimalFillsMixin, field: "fills" | "strokes") => {
    const style = await styleName(field === "fills" ? node.fillStyleId : (node as MinimalStrokesMixin).strokeStyleId);
    return style ?? variableName(firstSolid((node as never)[field])?.boundVariables?.color);
  };
  // One name for four sides or corners that share it, four (or null for one that has none) otherwise.
  const fourNames = async (bound: Record<string, unknown>, fields: string[]) => {
    const names = await Promise.all(fields.map((field) => variableName(bound[field] as VariableAlias | undefined)));
    if (names.every((name) => name === null)) return null;
    return names.every((name) => name === names[0]) ? names[0] : names;
  };
  async function tokensOf(node: Box | TextNode, label?: TextNode) {
    const bound = (node.boundVariables ?? {}) as Record<string, VariableAlias | VariableAlias[] | undefined>;
    const tokens: Record<string, unknown> = {};
    const set = (key: string, value: unknown) => {
      if (value !== null && value !== undefined) tokens[key] = value;
    };
    if (node.type !== "TEXT") {
      set("fill", await paintToken(node, "fills"));
      set("stroke", await paintToken(node, "strokes"));
      set("strokeWeight", await fourNames(bound, ["strokeTopWeight", "strokeRightWeight", "strokeBottomWeight", "strokeLeftWeight"]));
      set("radius", await fourNames(bound, ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]));
      set("gap", await variableName(bound.itemSpacing));
      set("rowGap", await variableName(bound.counterAxisSpacing));
      set("padding", await fourNames(bound, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]));
      for (const field of ["width", "height", "minWidth", "maxWidth", "minHeight", "maxHeight"]) {
        set(field, await variableName(bound[field]));
      }
      set("effect", await styleName(node.effectStyleId));
    }
    set("opacity", await variableName(bound.opacity));
    const text = node.type === "TEXT" ? node : label;
    if (text) {
      const textBound = (text.boundVariables ?? {}) as Record<string, VariableAlias | VariableAlias[] | undefined>;
      set("text", await styleName(text.textStyleId));
      set("textColor", await paintToken(text, "fills"));
      for (const field of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing"]) {
        set(field, await variableName(textBound[field]));
      }
    }
    return Object.keys(tokens).length > 0 ? { tokens } : {};
  }

  type Box = FrameNode | ComponentNode | InstanceNode;
  const isBox = (node: BaseNode): node is Box =>
    node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
  // The children auto layout places: not hidden, not absolutely positioned.
  const flow = (node: Box) =>
    node.layoutMode === "NONE"
      ? []
      : node.children.filter((child) => child.visible && !("layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE"));
  const firstText = (node: Box) => node.children.find((child): child is TextNode => child.type === "TEXT" && child.visible);
  // A long text makes a long key; its first 40 characters are enough to find it.
  const short = (text: string) => (text.length > 40 ? text.slice(0, 39) + "…" : text);
  // What a box on a page is called in a key. A frame: its layer name ("Header"). An instance: its
  // text property named label or title ("Date of injury" for a TextField, whose first text child
  // is its description), else its own text ("Save draft"), else its first text property, else
  // its name. Properties come in no set order, so the named ones go first.
  const labelOf = (node: Box) => {
    if (node.type !== "INSTANCE") return node.name;
    const texts = Object.entries(node.componentProperties).filter(([, p]) => p.type === "TEXT");
    const named = texts.find(([name]) => /^(label|title)$/i.test(name.split("#")[0]!));
    const text = named?.[1].value ?? firstText(node)?.characters ?? texts[0]?.[1].value;
    return typeof text === "string" ? short(text) : node.name;
  };

  // Where auto layout puts the children, in CSS's words: justify-content along the direction,
  // align-items across it. Left out where it can't show: justify when a child fills the
  // direction (it takes the room), align when every child fills across.
  const sizingAlong = (child: SceneNode, horizontal: boolean) =>
    "layoutSizingHorizontal" in child ? (horizontal ? child.layoutSizingHorizontal : child.layoutSizingVertical) : "FIXED";
  function alignment(node: Box, laidOut: SceneNode[]) {
    const horizontal = node.layoutMode === "HORIZONTAL";
    const justify = css({ MIN: "start", CENTER: "center", MAX: "end", SPACE_BETWEEN: "space-between" }, node.primaryAxisAlignItems);
    const align = css({ MIN: "start", CENTER: "center", MAX: "end", BASELINE: "baseline" }, node.counterAxisAlignItems);
    return {
      ...(!laidOut.some((child) => sizingAlong(child, horizontal) === "FILL") && { justify }),
      ...(!laidOut.every((child) => sizingAlong(child, !horizontal) === "FILL") && { align }),
    };
  }

  async function describe(node: Box, withLabel: boolean) {
    const label = withLabel ? firstText(node) : undefined;
    const laidOut = flow(node);
    const stroke = solid(node.strokes);
    const weight = single(node.strokeWeight);
    const radius = single(node.cornerRadius);
    const shadows = node.effects.filter(
      (effect): effect is DropShadowEffect | InnerShadowEffect =>
        (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") && effect.visible !== false,
    );
    // A ring: a drop shadow that only spreads, with no blur and no offset.
    const isRing = (effect: DropShadowEffect | InnerShadowEffect) =>
      effect.type === "DROP_SHADOW" && effect.radius === 0 && effect.offset.x === 0 && effect.offset.y === 0;
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fill: solid(node.fills),
      stroke,
      // One weight, or top, right, bottom, left when the sides differ.
      strokeWeight: stroke ? (weight ?? [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight]) : 0,
      // One radius, or top-left, top-right, bottom-right, bottom-left when the corners differ.
      radius: radius ?? [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius],
      // Spread-only shadows are how Figma draws a focus ring: [colour, spread], outermost first.
      rings: shadows.flatMap((effect) => (isRing(effect) ? [[hex(effect.color, effect.color.a), effect.spread ?? 0]] : [])),
      label: label
        ? {
            x: label.x,
            y: label.y,
            height: label.height,
            color: solid(label.fills),
            ...typeOf(label),
          }
        : null,
      ...(laidOut.length >= 2 && {
        layout: {
          direction: node.layoutMode === "VERTICAL" ? "column" : "row",
          gap: node.itemSpacing,
          padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
          // Where a stroke sits relative to the padding. Off (Figma's default), the stroke is drawn
          // over the padding, which is measured from the node's edge. On, the stroke takes room of
          // its own and the padding starts inside it, as padding does inside a CSS border. Only
          // recorded for a node with a stroke, where it changes where the children start.
          ...(stroke !== null && { strokesIncludedInLayout: node.strokesIncludedInLayout }),
          ...alignment(node, laidOut),
          // Children that wrap onto more lines, with the gap between the lines.
          ...(node.layoutWrap === "WRAP" && { wrap: true, rowGap: node.counterAxisSpacing ?? 0 }),
        },
      }),
      opacity: round(node.opacity),
      // Inside (a CSS border), outside (an outline) or centred (half each, which CSS can't draw).
      ...(stroke !== null && { strokeAlign: node.strokeAlign.toLowerCase() }),
      ...(stroke !== null && node.dashPattern.length > 0 && { dashed: true }),
      // Every other shadow, in the order CSS lists them: a blur, an offset, or an inset ring.
      shadows: shadows
        .filter((effect) => !isRing(effect))
        .map((effect) => ({
          x: effect.offset.x,
          y: effect.offset.y,
          blur: effect.radius,
          spread: effect.spread ?? 0,
          color: hex(effect.color, effect.color.a),
          inset: effect.type === "INNER_SHADOW",
        })),
      // How auto layout sizes it, across and down: hug its content, fill its parent, or fixed.
      sizing: [node.layoutSizingHorizontal, node.layoutSizingVertical].map((sizing) => sizing.toLowerCase()),
      ...Object.fromEntries(
        (["minWidth", "maxWidth", "minHeight", "maxHeight"] as const).flatMap((field) =>
          node[field] === null || node[field] === undefined ? [] : [[field, node[field]]],
        ),
      ),
      ...(await tokensOf(node, label)),
    };
  }

  // A text node on a page: where it sits, its size, and its type. `wraps` is true when its width
  // is set (the text wraps to it) rather than hugging the text.
  const describeText = async (node: TextNode) => ({
    id: node.id,
    type: "TEXT",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: solid(node.fills),
    ...typeOf(node),
    wraps: node.textAutoResize !== "WIDTH_AND_HEIGHT",
    opacity: round(node.opacity),
    ...(await tokensOf(node)),
  });

  const entries: [string, object][] = [];
  const keys = new Set<string>();
  const unique = (key: string) => {
    let candidate = key;
    for (let n = 2; keys.has(candidate); n++) candidate = `${key} (${n})`;
    keys.add(candidate);
    return candidate;
  };

  // Components: the node, and its laid-out children one level down.
  async function add(key: string, node: Box, isRoot = false) {
    const own = unique(key);
    const described = await describe(node, true);
    entries.push([own, isRoot ? { ...described, x: 0, y: 0 } : described]);
    const laidOut = flow(node);
    if (laidOut.length < 2) return;
    for (const child of laidOut) {
      if (!isBox(child)) continue;
      entries.push([unique(`${own} > ${firstText(child)?.characters ?? child.name}`), await describe(child, true)]);
    }
  }

  // Pages: every frame and text node under the root, stopping at instances, and walking through
  // groups and other containers without an entry for them.
  async function walk(parent: string, node: { children: readonly SceneNode[] }) {
    for (const child of node.children) {
      if (!child.visible) continue;
      if (child.type === "TEXT") {
        entries.push([unique(`${parent} > ${short(child.characters)}`), { ...(await describeText(child)), parent }]);
      } else if (isBox(child)) {
        const key = unique(`${parent} > ${labelOf(child)}`);
        if (child.type === "INSTANCE") {
          const main = await child.getMainComponentAsync();
          const component = main?.parent?.type === "COMPONENT_SET" ? main.parent.name : (main?.name ?? null);
          const variant = main?.parent?.type === "COMPONENT_SET" ? main.name : null;
          // A component from a library is the library's to measure. One made in this file (a
          // ClaimRow) has no code until the app builds it, so its insides are measured here.
          const local = main !== null && !main.remote;
          entries.push([key, { ...(await describe(child, !local)), type: "INSTANCE", component, variant, local, parent }]);
          if (local) await walk(key, child);
        } else {
          entries.push([key, { ...(await describe(child, false)), type: "FRAME", parent }]);
          await walk(key, child);
        }
      } else if ("children" in child) {
        await walk(parent, child);
      }
    }
  }

  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    const prefix = nodeIds.length > 1 && node ? `${node.name}/` : "";
    if (node?.type === "COMPONENT_SET") {
      for (const variant of node.children) if (isBox(variant)) await add(prefix + variant.name, variant);
    } else if (node?.type === "FRAME") {
      const key = unique(node.name);
      entries.push([key, { ...(await describe(node, false)), x: 0, y: 0, type: "FRAME", parent: null }]);
      await walk(key, node);
    } else if (node && isBox(node)) {
      await add(node.name, node, true);
    } else {
      throw new Error(`${nodeId} is not a component set, component, instance or frame`);
    }
  }

  const lines = entries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
  const body = `{\n  "file": ${JSON.stringify(figma.fileKey ?? null)},\n  "node": ${JSON.stringify(nodeIds.join(" "))},\n  "variants": {\n${lines.join(",\n")}\n  },\n`;

  // djb2 over the text above; the measuring helper (figma.ts, loadFigmaNodes) computes the same.
  let hash = 5381;
  for (let i = 0; i < body.length; i++) hash = ((hash * 33) ^ body.charCodeAt(i)) >>> 0;
  return `${body}  "hash": "${hash.toString(16)}"\n}\n`;
}
