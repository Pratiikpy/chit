/*
 * `@nimiq/identicons` ships no declarations (checked: no .d.ts in dist/, no "types" field).
 * Only the two methods chit calls are declared, from the package README.
 */
declare module '@nimiq/identicons/dist/identicons.bundle.min.js' {
  interface IdenticonsLib {
    /** A complete `<svg>` document for the given text. */
    svg(text: string): Promise<string>;
    /** The same as a `data:image/svg+xml;base64,…` URL, usable as an `img.src`. */
    toDataUrl(text: string): Promise<string>;
  }
  const Identicons: IdenticonsLib;
  export default Identicons;
}
