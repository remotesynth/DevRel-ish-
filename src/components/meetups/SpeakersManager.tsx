import { useState, useRef } from "react";

interface Speaker {
  id: string;
  speakerName: string;
  speakerJobTitle: string | null;
  speakerCompany: string | null;
  speakerImageUrl: string | null;
  speakerBio: string | null;
  sortOrder: number;
}

interface Session {
  id: string;
  title: string;
  abstract: string | null;
  startTime: string | null;
  sortOrder: number;
  speakerIds: string[];
}

interface Props {
  gatheringId: string;
  initialSpeakers: Speaker[];
  initialSessions: Session[];
}

type SpeakerForm = {
  speakerName: string;
  speakerJobTitle: string;
  speakerCompany: string;
  speakerBio: string;
  speakerImageUrl: string;
};

type SessionForm = {
  title: string;
  abstract: string;
  startTime: string;
  speakerIds: string[];
};

const emptySpeakerForm: SpeakerForm = {
  speakerName: "",
  speakerJobTitle: "",
  speakerCompany: "",
  speakerBio: "",
  speakerImageUrl: "",
};

const emptySessionForm: SessionForm = {
  title: "",
  abstract: "",
  startTime: "",
  speakerIds: [],
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function SpeakersManager({ gatheringId, initialSpeakers, initialSessions }: Props) {
  const [speakers, setSpeakers] = useState<Speaker[]>(initialSpeakers);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);

  // Speaker form state
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [speakerForm, setSpeakerForm] = useState<SpeakerForm>(emptySpeakerForm);
  const [savingSpeaker, setSavingSpeaker] = useState(false);
  const [speakerError, setSpeakerError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const [deleteSpeakerConfirm, setDeleteSpeakerConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speakerFormRef = useRef<HTMLDivElement>(null);

  // Session form state
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState<SessionForm>(emptySessionForm);
  const [savingSession, setSavingSession] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState<string | null>(null);
  const sessionFormRef = useRef<HTMLDivElement>(null);

  // ── Speaker handlers ──────────────────────────────────────────────────────

  function startAddSpeaker() {
    setEditingSpeakerId(null);
    setSpeakerForm(emptySpeakerForm);
    setImagePreview("");
    setSpeakerError("");
    setShowSpeakerForm(true);
    setTimeout(() => speakerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function startEditSpeaker(s: Speaker) {
    setEditingSpeakerId(s.id);
    setSpeakerForm({
      speakerName: s.speakerName,
      speakerJobTitle: s.speakerJobTitle ?? "",
      speakerCompany: s.speakerCompany ?? "",
      speakerBio: s.speakerBio ?? "",
      speakerImageUrl: s.speakerImageUrl ?? "",
    });
    setImagePreview(s.speakerImageUrl ?? "");
    setSpeakerError("");
    setShowSpeakerForm(true);
    setTimeout(() => speakerFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelSpeakerForm() {
    setShowSpeakerForm(false);
    setEditingSpeakerId(null);
    setSpeakerForm(emptySpeakerForm);
    setImagePreview("");
    setSpeakerError("");
  }

  function updateSpeaker(field: keyof SpeakerForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setSpeakerForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingImage(true);
    setSpeakerError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload/speaker-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSpeakerForm((f) => ({ ...f, speakerImageUrl: data.url }));
    } catch (err) {
      setSpeakerError(err instanceof Error ? err.message : "Image upload failed.");
      setImagePreview("");
      setSpeakerForm((f) => ({ ...f, speakerImageUrl: "" }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSpeakerSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploadingImage) return;
    const speakerName = speakerForm.speakerName.trim();
    if (!speakerName) { setSpeakerError("Speaker name is required."); return; }
    setSavingSpeaker(true);
    setSpeakerError("");
    try {
      const url = editingSpeakerId
        ? `/api/gatherings/${gatheringId}/speakers/${editingSpeakerId}`
        : `/api/gatherings/${gatheringId}/speakers`;
      const method = editingSpeakerId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(speakerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (editingSpeakerId) {
        setSpeakers((prev) => prev.map((s) => s.id === editingSpeakerId ? data.speaker : s));
      } else {
        setSpeakers((prev) => [...prev, data.speaker]);
      }
      cancelSpeakerForm();
    } catch (err) {
      setSpeakerError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingSpeaker(false);
    }
  }

  async function handleDeleteSpeaker(speakerId: string) {
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/speakers/${speakerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSpeakers((prev) => prev.filter((s) => s.id !== speakerId));
      // Remove speaker from any sessions in local state too
      setSessions((prev) => prev.map((sess) => ({
        ...sess,
        speakerIds: sess.speakerIds.filter((id) => id !== speakerId),
      })));
      setDeleteSpeakerConfirm(null);
      if (editingSpeakerId === speakerId) cancelSpeakerForm();
    } catch {
      setSpeakerError("Failed to remove speaker.");
    }
  }

  // ── Session handlers ──────────────────────────────────────────────────────

  function startAddSession() {
    setEditingSessionId(null);
    setSessionForm(emptySessionForm);
    setSessionError("");
    setShowSessionForm(true);
    setTimeout(() => sessionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function startEditSession(s: Session) {
    setEditingSessionId(s.id);
    setSessionForm({
      title: s.title,
      abstract: s.abstract ?? "",
      startTime: s.startTime ?? "",
      speakerIds: s.speakerIds,
    });
    setSessionError("");
    setShowSessionForm(true);
    setTimeout(() => sessionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function cancelSessionForm() {
    setShowSessionForm(false);
    setEditingSessionId(null);
    setSessionForm(emptySessionForm);
    setSessionError("");
  }

  function updateSession(field: keyof Omit<SessionForm, "speakerIds">) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setSessionForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  function toggleSessionSpeaker(speakerId: string) {
    setSessionForm((f) => ({
      ...f,
      speakerIds: f.speakerIds.includes(speakerId)
        ? f.speakerIds.filter((id) => id !== speakerId)
        : [...f.speakerIds, speakerId],
    }));
  }

  async function handleSessionSubmit(e: React.FormEvent) {
    e.preventDefault();
    const title = sessionForm.title.trim();
    if (!title) { setSessionError("Session title is required."); return; }
    setSavingSession(true);
    setSessionError("");
    try {
      const url = editingSessionId
        ? `/api/gatherings/${gatheringId}/sessions/${editingSessionId}`
        : `/api/gatherings/${gatheringId}/sessions`;
      const method = editingSessionId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (editingSessionId) {
        setSessions((prev) => prev.map((s) => s.id === editingSessionId ? data.session : s));
      } else {
        setSessions((prev) => [...prev, data.session]);
      }
      cancelSessionForm();
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSavingSession(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    try {
      const res = await fetch(`/api/gatherings/${gatheringId}/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setDeleteSessionConfirm(null);
      if (editingSessionId === sessionId) cancelSessionForm();
    } catch {
      setSessionError("Failed to remove session.");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="speakers-manager">

      {/* ── Speakers section ── */}
      <section className="sm-section">
        <h2 className="sm-section-heading">Speakers</h2>

        {speakers.length === 0 && !showSpeakerForm && (
          <div className="sm-empty-state">
            <p>No speakers added yet.</p>
          </div>
        )}

        {speakers.length > 0 && (
          <div className="sm-speaker-list">
            {speakers.map((s) => (
              <div key={s.id} className={`sm-speaker-card${editingSpeakerId === s.id ? " is-editing" : ""}`}>
                <div className="sm-card-body">
                  {s.speakerImageUrl ? (
                    <img src={s.speakerImageUrl} alt={s.speakerName} className="sm-avatar" width={48} height={48} />
                  ) : (
                    <div className="sm-avatar-placeholder" aria-hidden="true">{s.speakerName.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="sm-card-info">
                    <span className="sm-card-name">{s.speakerName}</span>
                    {(s.speakerJobTitle || s.speakerCompany) && (
                      <span className="sm-card-meta">{[s.speakerJobTitle, s.speakerCompany].filter(Boolean).join(" · ")}</span>
                    )}
                  </div>
                </div>
                <div className="sm-card-actions">
                  {deleteSpeakerConfirm === s.id ? (
                    <div className="sm-delete-confirm">
                      <span>Remove?</span>
                      <button type="button" className="btn btn-danger btn-xs" onClick={() => handleDeleteSpeaker(s.id)}>Yes</button>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDeleteSpeakerConfirm(null)}>No</button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditSpeaker(s)}>Edit</button>
                      <button type="button" className="sm-btn-remove" onClick={() => setDeleteSpeakerConfirm(s.id)} aria-label={`Remove ${s.speakerName}`}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!showSpeakerForm && (
          <button type="button" className="btn btn-secondary sm-add-btn" onClick={startAddSpeaker}>+ Add speaker</button>
        )}

        {showSpeakerForm && (
          <div className="sm-form-wrap" ref={speakerFormRef}>
            <h3 className="sm-form-heading">{editingSpeakerId ? "Edit speaker" : "Add a speaker"}</h3>
            {speakerError && <div className="alert alert-error" role="alert">{speakerError}</div>}
            <form onSubmit={handleSpeakerSubmit} className="sm-form" noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="speakerName">Name *</label>
                  <input id="speakerName" type="text" value={speakerForm.speakerName} onChange={updateSpeaker("speakerName")} placeholder="Alex Johnson" required maxLength={100} />
                </div>
                <div className="form-group">
                  <label htmlFor="speakerJobTitle">Job title</label>
                  <input id="speakerJobTitle" type="text" value={speakerForm.speakerJobTitle} onChange={updateSpeaker("speakerJobTitle")} placeholder="Developer Advocate" maxLength={100} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="speakerCompany">Company</label>
                <input id="speakerCompany" type="text" value={speakerForm.speakerCompany} onChange={updateSpeaker("speakerCompany")} placeholder="Ridgeline Labs" maxLength={100} />
              </div>
              <div className="form-group">
                <label>Photo</label>
                <div className="sm-image-area">
                  {imagePreview && <img src={imagePreview} alt="Preview" className="sm-image-preview" width={72} height={72} />}
                  <div className="sm-image-controls">
                    <label htmlFor="speakerImage" className="btn btn-ghost btn-sm sm-upload-label">
                      {uploadingImage ? "Uploading…" : imagePreview ? "Change photo" : "Upload photo"}
                    </label>
                    <input id="speakerImage" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={uploadingImage} ref={fileInputRef} className="sm-file-hidden" />
                    {imagePreview && !uploadingImage && (
                      <button type="button" className="sm-btn-remove-image" onClick={() => { setImagePreview(""); setSpeakerForm((f) => ({ ...f, speakerImageUrl: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}>Remove</button>
                    )}
                    <span className="form-hint">JPEG, PNG, or WebP · max 5MB · cropped to 400×400</span>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="speakerBio">Bio</label>
                <textarea id="speakerBio" value={speakerForm.speakerBio} onChange={updateSpeaker("speakerBio")} placeholder="A short bio…" rows={3} maxLength={500} />
                <span className="form-hint">Max 500 characters.</span>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={savingSpeaker || uploadingImage}>
                  {savingSpeaker ? "Saving…" : editingSpeakerId ? "Save changes →" : "Add speaker →"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelSpeakerForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* ── Sessions section ── */}
      <section className="sm-section">
        <h2 className="sm-section-heading">Agenda / Sessions</h2>

        {sessions.length === 0 && !showSessionForm && (
          <div className="sm-empty-state">
            <p>No sessions added yet.</p>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="sm-session-list">
            {sessions.map((s) => {
              const assignedSpeakers = s.speakerIds
                .map((id) => speakers.find((sp) => sp.id === id))
                .filter(Boolean) as Speaker[];
              return (
                <div key={s.id} className={`sm-session-card${editingSessionId === s.id ? " is-editing" : ""}`}>
                  <div className="sm-session-info">
                    <div className="sm-session-title-row">
                      {s.startTime && <span className="sm-session-time">{formatTime(s.startTime)}</span>}
                      <span className="sm-session-title">{s.title}</span>
                    </div>
                    {assignedSpeakers.length > 0 && (
                      <div className="sm-session-speakers">
                        {assignedSpeakers.map((sp) => (
                          <span key={sp.id} className="sm-session-speaker-chip">
                            {sp.speakerImageUrl && <img src={sp.speakerImageUrl} alt="" width={16} height={16} className="sm-chip-avatar" />}
                            {sp.speakerName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="sm-card-actions">
                    {deleteSessionConfirm === s.id ? (
                      <div className="sm-delete-confirm">
                        <span>Remove?</span>
                        <button type="button" className="btn btn-danger btn-xs" onClick={() => handleDeleteSession(s.id)}>Yes</button>
                        <button type="button" className="btn btn-ghost btn-xs" onClick={() => setDeleteSessionConfirm(null)}>No</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEditSession(s)}>Edit</button>
                        <button type="button" className="sm-btn-remove" onClick={() => setDeleteSessionConfirm(s.id)} aria-label={`Remove ${s.title}`}>Remove</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!showSessionForm && (
          <button type="button" className="btn btn-secondary sm-add-btn" onClick={startAddSession}>+ Add session</button>
        )}

        {showSessionForm && (
          <div className="sm-form-wrap" ref={sessionFormRef}>
            <h3 className="sm-form-heading">{editingSessionId ? "Edit session" : "Add a session"}</h3>
            {sessionError && <div className="alert alert-error" role="alert">{sessionError}</div>}
            <form onSubmit={handleSessionSubmit} className="sm-form" noValidate>
              <div className="form-group">
                <label htmlFor="sessionTitle">Title *</label>
                <input id="sessionTitle" type="text" value={sessionForm.title} onChange={updateSession("title")} placeholder="Building Better Developer Communities" required maxLength={150} />
              </div>
              <div className="form-group">
                <label htmlFor="sessionAbstract">Abstract</label>
                <textarea id="sessionAbstract" value={sessionForm.abstract} onChange={updateSession("abstract")} placeholder="A short description of what this session covers…" rows={3} maxLength={1000} />
              </div>
              <div className="form-group sm-narrow">
                <label htmlFor="sessionStartTime">Start time</label>
                <input id="sessionStartTime" type="time" value={sessionForm.startTime} onChange={updateSession("startTime")} />
                <span className="form-hint">Optional — useful when you have multiple sessions.</span>
              </div>

              {speakers.length > 0 && (
                <div className="form-group">
                  <label>Speakers</label>
                  <div className="sm-speaker-checkboxes">
                    {speakers.map((sp) => (
                      <label key={sp.id} className="sm-speaker-checkbox-row">
                        <input
                          type="checkbox"
                          checked={sessionForm.speakerIds.includes(sp.id)}
                          onChange={() => toggleSessionSpeaker(sp.id)}
                        />
                        {sp.speakerImageUrl && <img src={sp.speakerImageUrl} alt="" width={24} height={24} className="sm-checkbox-avatar" />}
                        <span className="sm-checkbox-name">{sp.speakerName}</span>
                        {sp.speakerJobTitle && <span className="sm-checkbox-meta">{sp.speakerJobTitle}{sp.speakerCompany ? ` · ${sp.speakerCompany}` : ""}</span>}
                      </label>
                    ))}
                  </div>
                  <span className="form-hint">Optional — assign one or more speakers to this session.</span>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={savingSession}>
                  {savingSession ? "Saving…" : editingSessionId ? "Save changes →" : "Add session →"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelSessionForm}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
