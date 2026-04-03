import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);
const FROM = import.meta.env.RESEND_FROM ?? "hello@devrelish.tech";
const SITE_NAME = "DevRel(ish)";

export async function sendFollowConfirmation({
  to,
  name,
  groupName,
  confirmUrl,
  unsubscribeUrl,
}: {
  to: string;
  name?: string | null;
  groupName: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}) {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  await resend.emails.send({
    from: `${SITE_NAME} <${FROM}>`,
    to,
    subject: `Confirm your follow of ${groupName}`,
    html: `
      <p>${greeting}</p>
      <p>You asked to follow <strong>${groupName}</strong> on ${SITE_NAME}. Click the button below to confirm and start receiving updates when new gatherings are posted.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${confirmUrl}" style="background:#7c3aed;color:#fff;padding:0.6rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;">Confirm subscription →</a>
      </p>
      <p style="font-size:0.85em;color:#666;">If you didn't request this, you can safely ignore this email. The link expires in 48 hours.</p>
      <p style="font-size:0.85em;color:#666;">Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>
    `,
    text: `${greeting}\n\nYou asked to follow ${groupName} on ${SITE_NAME}.\n\nConfirm your subscription: ${confirmUrl}\n\nIf you didn't request this, ignore this email.\nUnsubscribe: ${unsubscribeUrl}`,
  });
}

export async function sendGatheringNotification({
  followers,
  group,
  gathering,
  rsvpUrl,
}: {
  followers: Array<{ email: string; name?: string | null; token: string }>;
  group: { name: string; slug: string };
  gathering: {
    title: string;
    date: Date;
    time: string;
    venue: string;
    city?: string | null;
    country?: string | null;
    eventContext?: string | null;
  };
  rsvpUrl: string;
}) {
  const dateStr = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(gathering.date);
  const locationParts = [gathering.city, gathering.country].filter(Boolean).join(", ");
  const locationLine = gathering.eventContext
    ? `${gathering.eventContext}${locationParts ? ` · ${locationParts}` : ""}`
    : locationParts || gathering.venue;

  // Send individually so each has their own unsubscribe link
  await Promise.allSettled(
    followers.map(({ email, name, token }) => {
      const greeting = name ? `Hi ${name},` : "Hi there,";
      const unsubscribeUrl = `${new URL(rsvpUrl).origin}/follow/unsubscribe/${token}`;
      return resend.emails.send({
        from: `${SITE_NAME} <${FROM}>`,
        to: email,
        subject: `New gathering: ${gathering.title} — ${group.name}`,
        html: `
          <p>${greeting}</p>
          <p><strong>${group.name}</strong> has posted a new gathering:</p>
          <table style="margin:1rem 0;border-left:3px solid #7c3aed;padding-left:1rem;border-collapse:collapse;">
            <tr><td style="font-size:1.1em;font-weight:700;padding-bottom:0.25rem;">${gathering.title}</td></tr>
            <tr><td style="color:#555;">${dateStr} · ${gathering.time}</td></tr>
            <tr><td style="color:#555;">${gathering.venue}${locationLine ? ` · ${locationLine}` : ""}</td></tr>
          </table>
          <p style="margin: 1.5rem 0;">
            <a href="${rsvpUrl}" style="background:#7c3aed;color:#fff;padding:0.6rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;">RSVP →</a>
          </p>
          <p style="font-size:0.85em;color:#666;">You're receiving this because you follow ${group.name} on ${SITE_NAME}. <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>
        `,
        text: `${greeting}\n\n${group.name} has posted a new gathering:\n\n${gathering.title}\n${dateStr} · ${gathering.time}\n${gathering.venue}${locationLine ? ` · ${locationLine}` : ""}\n\nRSVP: ${rsvpUrl}\n\nUnsubscribe: ${unsubscribeUrl}`,
      });
    })
  );
}
