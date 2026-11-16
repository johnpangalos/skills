// Returns the Figma file's variables, text styles and effect styles as the text of
// the project's token snapshot. Read-only: it changes nothing in Figma. Run it with the Figma MCP
// (`node scripts/print.ts export-tokens` prints the code for `use_figma`); the Variables REST
// API is Enterprise-only, so this is how the snapshot is refreshed.
//
// Variables: `{ value, web }` per variable, `value` in the collection's first mode and `web` its
// code syntax (null when it has none). A variable whose value is another variable (an alias) is
// followed through the chain to a concrete value, and gets `alias`, the name of the variable it
// points at. A chain that loops, or ends at a variable the file can't find, gives a null value.
// A collection with two or more modes also gives each variable `modes: { <mode name>: value }`.
//
// Text styles: `{ family, style, size, lineHeight, weight, letterSpacing, textCase, textDecoration }`.
// `lineHeight` and `letterSpacing` are in px (a percent is of the size; `lineHeight` is "AUTO" when
// it is automatic). `weight` is the bound fontWeight variable's value, else the weight of the
// style's font (`Semi Bold` is 600, `Bold Italic` 700), null when neither says. `textCase` and `textDecoration`
// are CSS's words.
//
// Effect styles: each shadow (`DROP_SHADOW`, `INNER_SHADOW`) with its offset, blur, spread, colour
// and alpha, and each blur (`LAYER_BLUR`, `BACKGROUND_BLUR`) as `{ type, blur }`. Hidden effects are
// left out.
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
  const round = (value: number) => Math.round(value * 100) / 100;
  const line = (name: string, value: unknown) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`;
  const block = (name: string, lines: string[]) => `  ${JSON.stringify(name)}: {\n${lines.join(",\n")}\n  }`;
  // Figma's words for text properties, in the words CSS uses; null for a word with none.
  const css = (words: Map<string, string>, value: string) => words.get(value) ?? null;
  const CASE = new Map([
    ["ORIGINAL", "none"], ["UPPER", "uppercase"], ["LOWER", "lowercase"], ["TITLE", "capitalize"],
    ["SMALL_CAPS", "small-caps"], ["SMALL_CAPS_FORCED", "small-caps"],
  ]);
  const DECORATION = new Map([["NONE", "none"], ["UNDERLINE", "underline"], ["STRIKETHROUGH", "line-through"]]);
  const WEIGHTS = new Map([
    ["thin", 100], ["extralight", 200], ["light", 300], ["regular", 400], ["medium", 500],
    ["semibold", 600], ["bold", 700], ["extrabold", 800], ["black", 900],
  ]);
  // The weight of a font style (`fontName.style`): spaces, case and an italic suffix are ignored,
  // so "Semi Bold Italic" is 600. Null when the style isn't a weight. Not the style's own name:
  // `text-sm/normal` names no weight word, but its font is "Regular".
  const weightOfFont = (fontStyle: string) => {
    const word = fontStyle.replace(/\s+/g, "").replace(/italic$/i, "").toLowerCase();
    return WEIGHTS.get(word) ?? null;
  };
  const isAlias = (value: unknown): value is VariableAlias =>
    typeof value === "object" && value !== null && (value as { type?: unknown }).type === "VARIABLE_ALIAS";

  // The first mode of the collection a variable is in, which is the mode its value is read from.
  const firstModeOf = async (variable: Variable) =>
    (await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId))?.modes[0]?.modeId ?? null;
  // What a variable holds in a mode, with aliases followed to a concrete value. `seen` holds the
  // variables already on the chain: meeting one again is a cycle, which gives null.
  const valueIn = async (variable: Variable, modeId: string, seen: Set<string>): Promise<unknown> => {
    if (seen.has(variable.id)) return null;
    seen.add(variable.id);
    const raw = variable.valuesByMode[modeId];
    return isAlias(raw) ? aliasValue(raw, seen) : (raw ?? null);
  };
  // The value an alias points at, in its target's first mode; null when the target is missing.
  const aliasValue = async (alias: VariableAlias, seen = new Set<string>()): Promise<unknown> => {
    const target = await figma.variables.getVariableByIdAsync(alias.id);
    const modeId = target ? await firstModeOf(target) : null;
    return target && modeId !== null ? valueIn(target, modeId, seen) : null;
  };
  // A colour as hex; any other value as it is.
  const formatted = (variable: Variable, value: unknown) =>
    variable.resolvedType === "COLOR" && value !== null ? hex(value as RGB) : value;

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
  const blocks: string[] = [];
  for (const collection of collections) {
    const lines: string[] = [];
    for (const variable of variables.filter((variable) => variable.variableCollectionId === collection.id)) {
      const raw = variable.valuesByMode[collection.modes[0]!.modeId];
      const target = isAlias(raw) ? await figma.variables.getVariableByIdAsync(raw.id) : null;
      const modes: Record<string, unknown> = {};
      if (collection.modes.length > 1) {
        for (const mode of collection.modes) {
          modes[mode.name] = formatted(variable, await valueIn(variable, mode.modeId, new Set()));
        }
      }
      const value = formatted(variable, await valueIn(variable, collection.modes[0]!.modeId, new Set()));
      lines.push(
        line(variable.name, {
          value,
          web: variable.codeSyntax.WEB ?? null,
          ...(target && { alias: target.name }),
          ...(collection.modes.length > 1 && { modes }),
        }),
      );
    }
    blocks.push(block(collection.name, lines));
  }

  const textLines: string[] = [];
  for (const style of localText.slice().sort((a, b) => a.fontSize - b.fontSize || a.name.localeCompare(b.name))) {
    const bound = style.boundVariables?.fontWeight;
    const lineHeight = style.lineHeight;
    // Pixels as they are; a percent of the size; "AUTO" as it is.
    const height =
      lineHeight.unit === "PIXELS" ? lineHeight.value : lineHeight.unit === "PERCENT" ? round((lineHeight.value / 100) * style.fontSize) : "AUTO";
    const tracking = style.letterSpacing.unit === "PIXELS" ? style.letterSpacing.value : (style.letterSpacing.value / 100) * style.fontSize;
    textLines.push(
      line(style.name, {
        family: style.fontName.family,
        style: style.fontName.style,
        size: style.fontSize,
        lineHeight: height,
        weight: bound ? await aliasValue(bound) : weightOfFont(style.fontName.style),
        letterSpacing: round(tracking),
        textCase: css(CASE, style.textCase),
        textDecoration: css(DECORATION, style.textDecoration),
      }),
    );
  }

  const effectLines: string[] = [];
  for (const style of localEffects) {
    const effects: Record<string, unknown>[] = [];
    for (const effect of style.effects) {
      if (effect.visible === false) continue;
      if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
        effects.push({
          type: effect.type,
          x: effect.offset.x,
          y: effect.offset.y,
          blur: effect.radius,
          spread: effect.spread ?? 0,
          color: hex(effect.color),
          alpha: round(effect.color.a),
        });
      } else if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
        effects.push({ type: effect.type, blur: effect.radius });
      }
    }
    effectLines.push(line(style.name, effects));
  }

  return `{\n${[...blocks, block("textStyles", textLines), block("effectStyles", effectLines)].join(",\n")}\n}\n`;
}
