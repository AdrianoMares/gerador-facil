export function isRequired(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}
