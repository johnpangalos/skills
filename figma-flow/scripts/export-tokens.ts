// Returns the Figma file's variables, text styles and effect styles as the text of
// the project's token snapshot. Read-only: it changes nothing in Figma. Run it with the Figma MCP
// (`node scripts/print.ts export-tokens` prints the code for `use_figma`); the Variables REST
// API is Enterprise-only, so this is how the snapshot is refreshed.
//
// It reads the file's own (local) variables and styles. Run it on the file that defines them: for
// a product file built from a published library, that is the library's file, not the product's.
// A product file holds only the library variables it uses, and the plugin API can't list the rest
// (`figma.teamLibrary` lists no collections there), so a snapshot from it would be empty or partial.
// When the file has no variables or styles of its own, it throws instead of returning an empty
// snapshot, naming the library collections the file's variables come from.
export default async function exportTokens(): Promise<string> {
  const hex = ({ r, g, b }: RGB) =>
    "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
  const line = (name: string, value: unknown) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`;
  const block = (name: string, lines: string[]) => `  ${JSON.stringify(name)}: {\n${lines.join(",\n")}\n  }`;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
  const [localText, localEffects] = await Promise.all([figma.getLocalTextStylesAsync(), figma.getLocalEffectStylesAsync()]);
  if (collections.length === 0 && localText.length === 0 && localEffects.length === 0) {
    // Which library collections the file's nodes are bound to, on the current page only (loading
    // every page is slow and not always allowed). Only for the message.
    const ids = new Set<string>();
    for (const node of figma.currentPage.findAll((node) => "boundVariables" in node)) {
      for (const bound of Object.values((node as SceneNode).boundVariables ?? {})) {
        for (const alias of ([] as VariableAlias[]).concat(bound as VariableAlias | VariableAlias[])) ids.add(alias.id);
      }
    }
    const names = new Set<string>();
    for (const id of ids) {
      const variable = await figma.variables.getVariableByIdAsync(id);
      const collection = variable && (await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId));
      if (collection?.remote) names.add(collection.name);
    }
    throw new Error(
      "This file has no variables or styles of its own" +
        (names.size > 0
          ? `; its nodes use a library's (${[...names].join(", ")}). Run export-tokens on the library's file.`
          : ". Run export-tokens on the file that defines them."),
    );
  }
  const blocks = collections.map((collection) => {
    const modeId = collection.modes[0]!.modeId;
    const lines = variables
      .filter((variable) => variable.variableCollectionId === collection.id)
      .map((variable) => {
        const raw = variable.valuesByMode[modeId];
        const value = variable.resolvedType === "COLOR" ? hex(raw as RGB) : raw;
        return line(variable.name, { value, web: variable.codeSyntax.WEB ?? null });
      });
    return block(collection.name, lines);
  });

  const textStyles = localText
    .slice()
    .sort((a, b) => a.fontSize - b.fontSize || a.name.localeCompare(b.name))
    .map((style) =>
      line(style.name, {
        family: style.fontName.family,
        style: style.fontName.style,
        size: style.fontSize,
        lineHeight: style.lineHeight.unit === "PIXELS" ? style.lineHeight.value : style.lineHeight.unit,
      }),
    );

  const effectStyles = localEffects.map((style) =>
    line(
      style.name,
      style.effects.flatMap((effect) =>
        effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW"
          ? [
              {
                type: effect.type,
                x: effect.offset.x,
                y: effect.offset.y,
                blur: effect.radius,
                spread: effect.spread ?? 0,
                color: hex(effect.color),
                alpha: Math.round(effect.color.a * 100) / 100,
              },
            ]
          : [],
      ),
    ),
  );

  return `{\n${[...blocks, block("textStyles", textStyles), block("effectStyles", effectStyles)].join(",\n")}\n}\n`;
}
