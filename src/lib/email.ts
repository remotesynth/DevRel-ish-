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

  // Send individually so each has their own unique unsubscribe link
  const baseUrl = new URL(rsvpUrl).origin;
  await Promise.allSettled(
    followers.map(({ email, name, token }) => {
      const greeting = name ? `Hi ${name},` : "Hi there,";
      const unsubscribeUrl = `${baseUrl}/follow/unsubscribe/${token}`;
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

export async function sendApprovalNotice({
  to,
  groupName,
  inviteUrl,
}: {
  to: string;
  groupName: string;
  inviteUrl: string;
}) {
  await resend.emails.send({
    from: `${SITE_NAME} <${FROM}>`,
    to,
    subject: `Your DevRel(ish) group has been approved: ${groupName}`,
    html: `
      <p>Hi there,</p>
      <p>Great news — <strong>${groupName}</strong> has been approved and is now live on ${SITE_NAME}!</p>
      <p>Click the link below to set up your organiser account and start scheduling gatherings. This link is valid for 7 days.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${inviteUrl}" style="background:#7c3aed;color:#fff;padding:0.6rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;">Set up your account →</a>
      </p>
      <p style="font-size:0.85em;color:#666;">If you didn't apply to start a group on ${SITE_NAME}, please ignore this email.</p>
    `,
    text: `Hi there,\n\nGreat news — ${groupName} has been approved and is now live on ${SITE_NAME}!\n\nSet up your organiser account (link valid for 7 days):\n${inviteUrl}\n\nIf you didn't apply to start a group on ${SITE_NAME}, please ignore this email.`,
  });
}

export async function sendContactMessageAlert({
  organizers,
  groupName,
  dashboardUrl,
}: {
  organizers: Array<{ email: string; name: string }>;
  groupName: string;
  dashboardUrl: string;
}) {
  await Promise.allSettled(
    organizers.map(({ email, name }) =>
      resend.emails.send({
        from: `${SITE_NAME} <${FROM}>`,
        to: email,
        subject: `New message for ${groupName}`,
        html: `
          <p>Hi ${name},</p>
          <p>Someone sent a message to <strong>${groupName}</strong> via the contact form on ${SITE_NAME}.</p>
          <p style="margin: 1.5rem 0;">
            <a href="${dashboardUrl}" style="background:#7c3aed;color:#fff;padding:0.6rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;">View message →</a>
          </p>
          <p style="font-size:0.85em;color:#666;">For security, the message content is only visible in your dashboard — it is not included in this email.</p>
        `,
        text: `Hi ${name},\n\nSomeone sent a message to ${groupName} via the contact form on ${SITE_NAME}.\n\nView it in your dashboard: ${dashboardUrl}\n\nThe message content is only visible in your dashboard and is not included in this email.`,
      })
    )
  );
}

export async function sendRsvpCancelLink({
  to,
  name,
  eventTitle,
  groupName,
  cancelUrl,
}: {
  to: string;
  name: string;
  eventTitle: string;
  groupName: string;
  cancelUrl: string;
}) {
  await resend.emails.send({
    from: `${SITE_NAME} <${FROM}>`,
    to,
    subject: `Your cancellation link for ${eventTitle}`,
    html: `
      <p>Hi ${name},</p>
      <p>You requested a link to cancel your RSVP for <strong>${eventTitle}</strong>, hosted by <strong>${groupName}</strong>.</p>
      <p style="margin: 1.5rem 0;">
        <a href="${cancelUrl}" style="background:#e8704a;color:#fff;padding:0.6rem 1.25rem;border-radius:6px;text-decoration:none;font-weight:600;">Cancel my RSVP →</a>
      </p>
      <p style="font-size:0.85em;color:#666;">This link will cancel your RSVP immediately when clicked. If you didn't request this, you can safely ignore this email — your spot is still reserved.</p>
    `,
    text: `Hi ${name},\n\nYou requested a link to cancel your RSVP for ${eventTitle}, hosted by ${groupName}.\n\nCancel your RSVP: ${cancelUrl}\n\nIf you didn't request this, ignore this email — your spot is still reserved.`,
  });
}

export async function sendCancellationNotice({
  rsvps,
  groupName,
  gathering,
}: {
  rsvps: Array<{ email: string; name: string }>;
  groupName: string;
  gathering: {
    title: string;
    date: Date;
    venue: string;
  };
}) {
  const dateStr = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(gathering.date);

  await Promise.allSettled(
    rsvps.map(({ email, name }) =>
      resend.emails.send({
        from: `${SITE_NAME} <${FROM}>`,
        to: email,
        subject: `Cancelled: ${gathering.title}`,
        html: `
          <p>Hi ${name},</p>
          <p>We're sorry to let you know that the following gathering has been cancelled:</p>
          <table style="margin:1rem 0;border-left:3px solid #e8704a;padding-left:1rem;border-collapse:collapse;">
            <tr><td style="font-size:1.1em;font-weight:700;padding-bottom:0.25rem;">${gathering.title}</td></tr>
            <tr><td style="color:#555;">${dateStr} · ${gathering.venue}</td></tr>
            <tr><td style="color:#555;">Organised by ${groupName}</td></tr>
          </table>
          <p style="color:#555;">If you have questions, you can reach the organiser through the group's page on ${SITE_NAME}.</p>
        `,
        text: `Hi ${name},\n\nWe're sorry to let you know that the following gathering has been cancelled:\n\n${gathering.title}\n${dateStr} · ${gathering.venue}\nOrganised by ${groupName}\n\nIf you have questions, you can reach the organiser through the group's page on ${SITE_NAME}.`,
      })
    )
  );
}
