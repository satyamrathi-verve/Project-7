import { Card, CardTitle, Icon } from "./Primitives";

export function NotesCard({ notes }: { notes: string | null }) {
  return (
    <Card>
      <CardTitle icon={<Icon>📝</Icon>} subtitle="Freeform remarks on this invoice">
        Notes
      </CardTitle>
      {notes ? (
        <p className="whitespace-pre-wrap text-sm text-ink-secondary">{notes}</p>
      ) : (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <Icon>🗒️</Icon>
          No notes added for this invoice.
        </p>
      )}
    </Card>
  );
}
