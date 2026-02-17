export const toTitleCase = (value) => {
  if (typeof value !== 'string' || value.length === 0) return value;

  let shouldCapitalize = true;
  let result = '';

  for (const char of value) {
    const isLetter = /[A-Za-z]/.test(char);
    if (isLetter) {
      result += shouldCapitalize ? char.toUpperCase() : char.toLowerCase();
      shouldCapitalize = false;
      continue;
    }

    result += char;
    if (char === ' ' || char === '-' || char === '\'' || char === '/' || char === '.') {
      shouldCapitalize = true;
    }
  }

  return result;
};
