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
// with its type. An instance of a library component gets one entry, its box, and nothing inside
// it: the component is the design system's to measure. An instance of a component made in this
// file (`local: true`) is opened like a frame, since the app builds it. Each entry names its `parent` entry, and its x and y are inside
// that parent. A frame's `label` is null here, because its text has entries of its own.
//
// Every entry has the node's `id`. Keys are unique: a repeated key is numbered (`Row`,
// `Row (2)`), since a JSON object keeps only the last of two equal keys and the first would go
// unmeasured.
//
// The last line is a hash of everything above it, which the tests check, so a copy that lost
// or changed a character fails instead of quietly testing against the wrong numbers.
export default async function exportNode(...nodeIds: string[]): Promise<string> {
  const hex = ({ r, g, b }: RGB) =>
    "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
  const solid = (paints: readonly Paint[] | typeof figma.mixed) => {
    const paint = Array.isArray(paints)
      ? paints.find((p): p is SolidPaint => p.type === "SOLID" && p.visible !== false)
      : undefined;
    return paint ? hex(paint.color) : null;
  };
  // Figma reports `figma.mixed` (a symbol) when a value differs within the node.
  const single = <T>(value: T | typeof figma.mixed) => (typeof value === "symbol" ? null : (value as T));
  const pixels = (lineHeight: LineHeight | typeof figma.mixed) => {
    const value = single(lineHeight);
    return value?.unit === "PIXELS" ? value.value : null;
  };

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

  function describe(node: Box, withLabel: boolean) {
    const label = withLabel ? firstText(node) : undefined;
    const laidOut = flow(node);
    return {
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      fill: solid(node.fills),
      stroke: solid(node.strokes),
      strokeWeight: solid(node.strokes) ? single(node.strokeWeight) : 0,
      radius: single(node.cornerRadius),
      // Spread-only shadows are how Figma draws a focus ring: [colour, spread], outermost first.
      rings: node.effects.flatMap((effect) =>
        effect.type === "DROP_SHADOW" && effect.visible !== false && effect.radius === 0
          ? [[hex(effect.color), effect.spread ?? 0]]
          : [],
      ),
      label: label
        ? {
            x: label.x,
            y: label.y,
            height: label.height,
            color: solid(label.fills),
            fontSize: single(label.fontSize),
            fontWeight: single(label.fontWeight),
            lineHeight: pixels(label.lineHeight),
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
          ...(solid(node.strokes) !== null && { strokesIncludedInLayout: node.strokesIncludedInLayout }),
        },
      }),
    };
  }

  // A text node on a page: where it sits, its size, and its type. `wraps` is true when its width
  // is set (the text wraps to it) rather than hugging the text.
  const describeText = (node: TextNode) => ({
    id: node.id,
    type: "TEXT",
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    color: solid(node.fills),
    fontSize: single(node.fontSize),
    fontWeight: single(node.fontWeight),
    lineHeight: pixels(node.lineHeight),
    wraps: node.textAutoResize !== "WIDTH_AND_HEIGHT",
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
  function add(key: string, node: Box, isRoot = false) {
    const own = unique(key);
    entries.push([own, isRoot ? { ...describe(node, true), x: 0, y: 0 } : describe(node, true)]);
    const laidOut = flow(node);
    if (laidOut.length < 2) return;
    for (const child of laidOut) {
      if (!isBox(child)) continue;
      entries.push([unique(`${own} > ${firstText(child)?.characters ?? child.name}`), describe(child, true)]);
    }
  }

  // Pages: every frame and text node under the root, stopping at instances.
  async function walk(parent: string, node: Box) {
    for (const child of node.children) {
      if (!child.visible) continue;
      if (child.type === "TEXT") {
        entries.push([unique(`${parent} > ${short(child.characters)}`), { ...describeText(child), parent }]);
      } else if (isBox(child)) {
        const key = unique(`${parent} > ${labelOf(child)}`);
        if (child.type === "INSTANCE") {
          const main = await child.getMainComponentAsync();
          const component = main?.parent?.type === "COMPONENT_SET" ? main.parent.name : (main?.name ?? null);
          const variant = main?.parent?.type === "COMPONENT_SET" ? main.name : null;
          // A component from a library is the library's to measure. One made in this file (a
          // ClaimRow) has no code until the app builds it, so its insides are measured here.
          const local = main !== null && !main.remote;
          entries.push([key, { ...describe(child, !local), type: "INSTANCE", component, variant, local, parent }]);
          if (local) await walk(key, child);
        } else {
          entries.push([key, { ...describe(child, false), type: "FRAME", parent }]);
          await walk(key, child);
        }
      }
    }
  }

  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    const prefix = nodeIds.length > 1 && node ? `${node.name}/` : "";
    if (node?.type === "COMPONENT_SET") {
      for (const variant of node.children) if (isBox(variant)) add(prefix + variant.name, variant);
    } else if (node?.type === "FRAME") {
      const key = unique(node.name);
      entries.push([key, { ...describe(node, false), x: 0, y: 0, type: "FRAME", parent: null }]);
      await walk(key, node);
    } else if (node && isBox(node)) {
      add(node.name, node, true);
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
