interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

type SignaturePart = string | number | boolean | null | undefined;

export function signatureOf(parts: readonly SignaturePart[]): string {
  return parts.join('|');
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className !== undefined) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs !== undefined) {
    for (const [key, value] of Object.entries(options.attrs)) {
      node.setAttribute(key, value);
    }
  }
  if (children.length > 0) node.append(...children);
  return node;
}
