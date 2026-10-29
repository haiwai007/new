const suffix =
  /^[\s-]*(?:pro(?:plus|max|mini)?|plus|max|ultra|mini|lite|fold|flip|fe|rsr|e|r)\b/i;
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A sibling model is not evidence for the base model, even when absent from our catalog. */
export function identifyModel(text, models) {
  const source = text.replaceAll("+", "plus");
  for (const model of [...models].sort(
    (a, b) => b.name.length - a.name.length,
  )) {
    const pattern = model.name
      .replaceAll("+", "plus")
      .split(/\s+/)
      .map(escape)
      .join("[\\s-]*");
    const match = new RegExp(`(?:^|[^a-z0-9])${pattern}(?![a-z0-9])`, "i").exec(
      source,
    );
    if (match) {
      if (suffix.test(source.slice(match.index + match[0].length)))
        return undefined;
      return model.id;
    }
  }
}
