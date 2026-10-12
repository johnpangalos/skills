// Returns one or more nodes as the text of an export file (<exports>/<name>.json): where each one
// sits, and the exact values it is drawn with. Read-only: it changes nothing in Figma. Run it
// with the Figma MCP (`node scripts/print.ts export-node 1:91` prints the code for `use_figma`)
// and save the result exactly as returned.
//
// One id that is a component set gives one entry per variant, keyed by the variant's name.
// Several ids (`export-node 18:13 18:14 18:23`) give entries keyed `<node name>/<variant>` for
// sets and `<node name>` for the rest. A node that lays out two or more children also gets
// `layout` (direction, gap, padding) and an entry per child, keyed `<parent> > <label or name>`
// with its position inside the parent.
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

  type Box = FrameNode | ComponentNode | InstanceNode;
  const isBox = (node: BaseNode): node is Box =>
    node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
  // The children auto layout places: not hidden, not absolutely positioned.
  const flow = (node: Box) =>
    node.layoutMode === "NONE"
      ? []
      : node.children.filter((child) => child.visible && !("layoutPositioning" in child && child.layoutPositioning === "ABSOLUTE"));

  function describe(node: Box) {
    const label = node.children.find((child): child is TextNode => child.type === "TEXT" && child.visible);
    const lineHeight = label ? single(label.lineHeight) : null;
    const laidOut = flow(node);
    return {
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
            lineHeight: lineHeight?.unit === "PIXELS" ? lineHeight.value : null,
          }
        : null,
      ...(laidOut.length >= 2 && {
        layout: {
          direction: node.layoutMode === "VERTICAL" ? "column" : "row",
          gap: node.itemSpacing,
          padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
        },
      }),
    };
  }

  const entries: [string, ReturnType<typeof describe>][] = [];
  function add(key: string, node: Box, isRoot = false) {
    entries.push([key, isRoot ? { ...describe(node), x: 0, y: 0 } : describe(node)]);
    const laidOut = flow(node);
    if (laidOut.length < 2) return;
    for (const child of laidOut) {
      if (!isBox(child)) continue;
      const text = child.children.find((c): c is TextNode => c.type === "TEXT" && c.visible);
      entries.push([`${key} > ${text?.characters ?? child.name}`, describe(child)]);
    }
  }

  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    const prefix = nodeIds.length > 1 && node ? `${node.name}/` : "";
    if (node?.type === "COMPONENT_SET") {
      for (const variant of node.children) if (isBox(variant)) add(prefix + variant.name, variant);
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
