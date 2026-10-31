import { MeetingPageShell } from './meeting-page-shell';

export default function MeetingNotFound(): React.JSX.Element {
  return (
    <MeetingPageShell>
      <main className="mt-12 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Meeting not found</h1>
        <p className="text-muted">
          This meeting does not exist, or it belongs to another account.
        </p>
      </main>
    </MeetingPageShell>
  );
}
