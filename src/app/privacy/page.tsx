import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { MESSAGES } from "@/lib/messages";

export default function PrivacyPage() {
  return (
    <PageShell>
      <AppBar narrow />
      <div className="page page-narrow">
        <h1 className="title">{MESSAGES.privacy.title}</h1>
        {MESSAGES.privacy.sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="label">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-soft">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
