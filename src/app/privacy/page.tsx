import { PageShell } from "@/components/PageShell";
import { MESSAGES } from "@/lib/messages";

export default function PrivacyPage() {
  return (
    <PageShell>
      <h1 className="text-2xl font-semibold text-neutral-50">{MESSAGES.privacy.title}</h1>
      {MESSAGES.privacy.sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-sm font-medium text-neutral-400">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-neutral-300">{paragraph}</p>
          ))}
        </section>
      ))}
    </PageShell>
  );
}
