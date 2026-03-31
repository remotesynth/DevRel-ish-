import { useState } from "react";

interface Props {
  meetupId: string;
  meetupTitle: string;
  spotsLeft: number;
}

interface FormData {
  name: string;
  email: string;
  jobTitle: string;
  company: string;
}

export default function RsvpForm({ meetupId, meetupTitle, spotsLeft }: Props) {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    jobTitle: "",
    company: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "duplicate">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/rsvp/${meetupId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.status === 409 && data.code === "duplicate") {
        setStatus("duplicate");
        return;
      }

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="success-state">
        <div className="success-icon" aria-hidden="true">🎉</div>
        <h2>You're in!</h2>
        <p>
          We've got your RSVP for <strong>{meetupTitle}</strong>. See you there!
        </p>
        <p>
          A confirmation has been noted for <strong>{form.email}</strong>.
        </p>
      </div>
    );
  }

  if (status === "duplicate") {
    return (
      <div className="alert alert-info" role="alert">
        <p>
          <strong>Already registered!</strong> Looks like{" "}
          <strong>{form.email}</strong> is already on the list for this gathering.
          We'll see you there!
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rsvp-form" noValidate>
      {status === "error" && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      {spotsLeft <= 5 && spotsLeft > 0 && (
        <div className="alert alert-warning">
          Only <strong>{spotsLeft}</strong> spot{spotsLeft === 1 ? "" : "s"} left — grab yours!
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name">Your name *</label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={update("name")}
          placeholder="Taylor Kim"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="email">Email address *</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={update("email")}
          placeholder="taylor@example.com"
          required
        />
        <span className="form-hint">We'll only use this to identify your RSVP.</span>
      </div>

      <div className="form-group">
        <label htmlFor="jobTitle">Job title *</label>
        <input
          id="jobTitle"
          type="text"
          value={form.jobTitle}
          onChange={update("jobTitle")}
          placeholder="Developer Advocate, Community Manager, DevRel Engineer..."
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="company">Company *</label>
        <input
          id="company"
          type="text"
          value={form.company}
          onChange={update("company")}
          placeholder="Acme Corp"
          required
        />
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={status === "loading"}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {status === "loading" ? "Reserving your spot…" : "Count me in! →"}
      </button>
    </form>
  );
}
