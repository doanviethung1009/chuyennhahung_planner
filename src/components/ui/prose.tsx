/** Long-form body copy for story, destination and about pages. */
export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="flex flex-col gap-6">
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className="text-lg leading-relaxed text-ink-800 md:text-[1.1875rem] md:leading-[1.75]"
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}
