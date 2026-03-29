import { useState } from "react";

interface Props {
  mode: "create" | "edit";
  meetupId?: string;
  initial?: {
    title: string;
    description: string;
    date: string;
    time: string;
    venue: string;
    address: string;
    capacity: number;
  };
}

type FormData = {
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  capacity: number;
};

const defaultForm: FormData = {
  title: "",
  description: "",
  date: "",
  time: "18:00",
  venue: "",
  address: "",
  capacity: 30,
};

export default function MeetupForm({ mode, meetupId, initial }: Props) {
  const [form, setForm] = useState<FormData>(initial ?? defaultForm);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function update(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = field === "capacity" ? Number(e.target.value) : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const url = mode === "edit" ? `/api/meetups/${meetupId}` : "/api/meetups";
    const method = mode === "edit" ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
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
      if (mode === "create") {
        window.location.href = "/dashboard/meetups";
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success" && mode === "edit") {
    return (
      <div className="alert alert-success" role="alert">
        Meetup updated successfully!{" "}
        <a href="/dashboard/meetups">Back to meetups</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="meetup-form" noValidate>
      {status === "error" && (
        <div className="alert alert-error" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="title">Meetup title *</label>
        <input
          id="title"
          type="text"
          value={form.title}
          onChange={update("title")}
          placeholder="Spring Social Gathering"
          required
          maxLength={100}
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          value={form.description}
          onChange={update("description")}
          placeholder="What will you do? What's the vibe? Who should come?"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input
            id="date"
            type="date"
            value={form.date}
            onChange={update("date")}
            required
            min={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div className="form-group">
          <label htmlFor="time">Time *</label>
          <input
            id="time"
            type="time"
            value={form.time}
            onChange={update("time")}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="venue">Venue name *</label>
        <input
          id="venue"
          type="text"
          value={form.venue}
          onChange={update("venue")}
          placeholder="The Interval at Long Now"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          type="text"
          value={form.address}
          onChange={update("address")}
          placeholder="2 Marina Blvd, San Francisco, CA 94123"
        />
      </div>

      <div className="form-group">
        <label htmlFor="capacity">Capacity *</label>
        <input
          id="capacity"
          type="number"
          value={form.capacity}
          onChange={update("capacity")}
          min={1}
          max={500}
          required
        />
        <span className="form-hint">How many people can attend?</span>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={status === "loading"}
        >
          {status === "loading"
            ? "Saving…"
            : mode === "create"
              ? "Create meetup →"
              : "Save changes →"}
        </button>
        <a href="/dashboard/meetups" className="btn btn-ghost">
          Cancel
        </a>
      </div>
    </form>
  );
}
