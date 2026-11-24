export function attachmentError(file: { name: string; type: string; size: number }): string | null {
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return 'Selecciona archivos PDF, JPG o PNG.';
  if (!file.size || file.size > 10 * 1024 * 1024) return 'Cada archivo debe tener contenido y no superar los 10 MB.';
  return null;
}
