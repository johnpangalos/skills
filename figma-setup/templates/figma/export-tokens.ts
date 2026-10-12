// Returns the Figma file's variables, text styles and effect styles as the text of
// figma/tokens.json. Read-only: it changes nothing in Figma. Run it with the Figma MCP
// (`node figma/print.ts export-tokens` prints the code for `use_figma`); the Variables REST
// API is Enterprise-only, so this is how the snapshot is refreshed.
export default async function exportTokens(): Promise<string> {
  const hex = ({ r, g, b }: RGB) =>
    "#" + [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
  const line = (name: string, value: unknown) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`;
  const block = (name: string, lines: string[]) => `  ${JSON.stringify(name)}: {\n${lines.join(",\n")}\n  }`;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const variables = await figma.variables.getLocalVariablesAsync();
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

  const textStyles = (await figma.getLocalTextStylesAsync())
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

  const effectStyles = (await figma.getLocalEffectStylesAsync()).map((style) =>
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
