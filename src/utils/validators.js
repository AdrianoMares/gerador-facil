export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function getValueAtPath(data, path) {
  return path.split('.').reduce((value, key) => value?.[key], data);
}

export function validateRequiredFields(data, rules) {
  const missingFields = rules
    .filter(({ path, validate = isRequired }) => !validate(getValueAtPath(data, path), data))
    .map(({ label }) => label);

  return {
    valid: missingFields.length === 0,
    missingFields
  };
}
