function toCamelCase(flag) {
  return flag.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function parseCliArgs(argv, {
  defaults = {},
  boolean = [],
  number = []
} = {}) {
  const args = argv.slice(2);
  const options = { ...defaults };
  const booleanKeys = new Set(boolean);
  const numberKeys = new Set(number);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;

    const key = toCamelCase(arg.slice(2));
    const next = args[i + 1];
    const hasValue = next && !next.startsWith('--');

    if (!hasValue) {
      if (booleanKeys.has(key)) {
        options[key] = true;
      }
      continue;
    }

    options[key] = numberKeys.has(key) ? Number(next) : next;
    i += 1;
  }

  for (const key of numberKeys) {
    if (!Object.hasOwn(options, key)) continue;
    if (options[key] === null || options[key] === undefined || options[key] === '') continue;
    if (typeof options[key] === 'number' && !Number.isNaN(options[key])) continue;

    const parsed = Number(options[key]);
    if (!Number.isNaN(parsed)) {
      options[key] = parsed;
    }
  }

  return options;
}
