import { useState } from "react";

interface FormData {
  name: string;
  city: string;
  region: string;
  country: string;
  description: string;
  contactEmail: string;
}

export default function GroupForm() {
  const [form, setForm] = useState<FormData>({
    name: "",
    city: "",
    region: "",
    country: "",
    description: "",
    contactEmail: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/groups/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

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
        <div className="success-icon" aria-hidden="true">✦</div>
        <h2>Application submitted!</h2>
        <p>
          Thanks for wanting to start a DevRel(ish) group! We'll review your application and be in
          touch at <strong>{form.contactEmail}</strong> shortly.
        </p>
        <p>
          In the meantime, check out the{" "}
          <a href="/groups">existing groups</a> to see if there's one near you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="group-form" noValidate>
      {status === "error" && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="form-section">
        <h3 className="section-title">About your group</h3>

        <div className="form-group">
          <label htmlFor="name">Group name *</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={update("name")}
            placeholder="DevRel(ish) Portland"
            required
            minLength={3}
            maxLength={80}
          />
          <span className="form-hint">
            Keep it short and location-based. We'll turn it into a URL like{" "}
            <code>/groups/portland</code>.
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description *</label>
          <textarea
            id="description"
            value={form.description}
            onChange={update("description")}
            placeholder="Tell us about your group — who it's for, the vibe, what you'll do together..."
            required
            minLength={50}
            maxLength={1000}
            rows={5}
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title">Location</h3>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">City *</label>
            <input
              id="city"
              type="text"
              value={form.city}
              onChange={update("city")}
              placeholder="Portland"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="region">State / Province</label>
            <input
              id="region"
              type="text"
              value={form.region}
              onChange={update("region")}
              placeholder="OR"
              maxLength={50}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="country">Country *</label>
          <input
            id="country"
            type="text"
            value={form.country}
            onChange={update("country")}
            placeholder="USA"
            required
          />
        </div>
      </div>

      <div className="form-section">
        <h3 className="section-title">Your contact info</h3>

        <div className="form-group">
          <label htmlFor="contactEmail">Email address *</label>
          <input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={update("contactEmail")}
            placeholder="you@example.com"
            required
          />
          <span className="form-hint">
            This is how we'll reach you when your group is approved. You'll use this to sign in.
          </span>
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Submitting…" : "Submit application →"}
        </button>
        <p className="form-hint">
          We review all applications within a few days. You'll hear from us either way!
        </p>
      </div>
    </form>
  );
}
