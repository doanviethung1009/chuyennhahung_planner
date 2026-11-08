/**
 * Emits a schema.org block. `<` is escaped so a stray "</script>" inside
 * content can never break out of the tag, even though all content here is
 * our own.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
