import { useEffect, useState } from "react";

interface DiscoveredEvent {
  uri: string;
  cid: string;
  name: string;
  startsAt: string | null;
  description: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  cancelled: boolean;
  alreadyAdopted: boolean;
}

type ImportResult = { uri: string; ok: boolean; name?: string; error?: string };

function formatWhen(startsAt: string | null): string {
  if (!startsAt) return "No date";
  const d = new Date(startsAt);
  if (isNaN(d.getTime())) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function formatPlace(ev: DiscoveredEvent): string {
  return [ev.venue, ev.city, ev.country].filter(Boolean).join(", ");
}

export default function AdoptEventsForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [events, setEvents] = useState<DiscoveredEvent[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);

  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/import/atproto-events");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not read your events.");
        const list: DiscoveredEvent[] = data.events ?? [];
        setEvents(list);
        // Preselect what's importable; past and already-adopted events stay off.
        setSelected(
          new Set(
            list
              .filter((e) => !e.alreadyAdopted && !e.cancelled && isUpcoming(e.startsAt))
              .map((e) => e.uri)
          )
        );
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not read your events.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(uri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) next.delete(uri);
      else next.add(uri);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import/atproto-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed.");
      setResults(data.results ?? []);
    } catch (err) {
      setResults([{ uri: "", ok: false, error: err instanceof Error ? err.message : "Import failed." }]);
    } finally {
      setImporting(false);
    }
  }

  async function handlePaste(e: React.FormEvent) {
    e.preventDefault();
    if (!pasted.trim()) return;
    setPasteBusy(true);
    setPasteError("");
    try {
      const res = await fetch("/api/import/atproto-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pasted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not import that event.");
      const first: ImportResult | undefined = data.results?.[0];
      if (first && !first.ok) throw new Error(first.error ?? "Could not import that event.");
      setResults(data.results ?? []);
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Could not import that event.");
    } finally {
      setPasteBusy(false);
    }
  }

  if (results.length > 0) {
    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    return (
      <div className="adopt-done">
        {ok.length > 0 && (
          <div className="alert alert-success">
            Brought {ok.length} event{ok.length === 1 ? "" : "s"} into your group.
          </div>
        )}
        {failed.length > 0 && (
          <div className="alert alert-warning">
            <strong>{failed.length} skipped:</strong>
            <ul className="adopt-fail-list">
              {failed.map((r, i) => (
                <li key={i}>{r.error}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="adopt-actions">
          <a href="/dashboard/gatherings" className="btn btn-primary">
            View my gatherings →
          </a>
        </div>
      </div>
    );
  }

  const importable = events.filter((e) => !e.alreadyAdopted);
  const already = events.filter((e) => e.alreadyAdopted);

  return (
    <div className="adopt-form">
      {loading && <p className="adopt-status">Reading your account…</p>}
      {loadError && <div className="alert alert-error">{loadError}</div>}

      {!loading && !loadError && events.length === 0 && (
        <div className="adopt-empty">
          <p>
            No calendar events found in your account yet. If you've created events on Smoke Signal,
            atmo.rsvp, or OpenMeet with <em>this</em> account, they'd show up here.
          </p>
        </div>
      )}

      {importable.length > 0 && (
        <>
          <div className="adopt-list">
            {importable.map((ev) => (
              <label key={ev.uri} className="adopt-item">
                <input
                  type="checkbox"
                  checked={selected.has(ev.uri)}
                  onChange={() => toggle(ev.uri)}
                />
                <div className="adopt-item-body">
                  <strong className="adopt-item-name">{ev.name}</strong>
                  <span className="adopt-item-meta">
                    {formatWhen(ev.startsAt)}
                    {formatPlace(ev) && ` · ${formatPlace(ev)}`}
                  </span>
                  {ev.cancelled && <span className="adopt-flag">Cancelled on the network</span>}
                  {!ev.cancelled && !isUpcoming(ev.startsAt) && (
                    <span className="adopt-flag muted">Already happened</span>
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="adopt-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importing || selected.size === 0}
            >
              {importing
                ? "Bringing them over…"
                : `Bring ${selected.size} event${selected.size === 1 ? "" : "s"} over →`}
            </button>
            <span className="adopt-note">
              Your original records aren't copied or changed — DevRel(ish) links to them where they are.
            </span>
          </div>
        </>
      )}

      {already.length > 0 && (
        <p className="adopt-status">
          {already.length} event{already.length === 1 ? " is" : "s are"} already on DevRel(ish).
        </p>
      )}

      <div className="adopt-paste">
        <h3>Somewhere else?</h3>
        <p>
          If the event isn't in this account — a co-organizer created it, say — paste its
          <code>at://</code> URI or a Smoke Signal event URL.
        </p>
        <form onSubmit={handlePaste} className="adopt-paste-form">
          <input
            type="text"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="at://did:plc:…/community.lexicon.calendar.event/…"
            aria-label="Event at:// URI or URL"
          />
          <button type="submit" className="btn btn-ghost" disabled={pasteBusy || !pasted.trim()}>
            {pasteBusy ? "Looking…" : "Add"}
          </button>
        </form>
        {pasteError && <div className="alert alert-error">{pasteError}</div>}
      </div>
    </div>
  );
}

function isUpcoming(startsAt: string | null): boolean {
  if (!startsAt) return false;
  const d = new Date(startsAt);
  return !isNaN(d.getTime()) && d >= new Date();
}
