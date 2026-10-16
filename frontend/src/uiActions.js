export function focusFirstFormField() {
  const field = document.querySelector(
    '.main-panel form input:not([type="hidden"]), .main-panel form select, .main-panel form textarea'
  );
  if (!field) return;

  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus({ preventScroll: true });
}