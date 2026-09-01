# ADR-0001: Use group-owned ATProto repositories for public records

- Status: Accepted
- Date: 2026-08-31

## Context

DevRelish is being relaunched on AT Protocol while remaining a free service.
The application currently creates some public group and event data in its
Turso database and then attempts to mirror it to a PDS. That makes local data
the effective source of truth, creates divergence when a PDS write fails, and
does not give a group a portable, shared identity.

Running a DevRelish-operated PDS would add ongoing operations, account
recovery responsibility, and hosting cost. It is not required for AT Protocol
applications to work.

## Decision

DevRelish will not operate a PDS. Each group will connect a dedicated existing
AT Protocol account, hosted by a PDS it chooses. That account is the group’s
publisher identity and authors the group’s public records.

The canonical public records are stored in the connected group account’s
repository:

- group records;
- calendar event records and their public metadata; and
- any future public records owned by the group.

Individual users retain ownership of their own membership and RSVP records in
their personal repositories. Turso stores private operational data (such as
email RSVP details, meeting links, contact messages, and cancel tokens), an
index/cache of public records, and a durable publication outbox. A local row
is not considered published until the corresponding PDS write is confirmed
with an AT URI and CID.

Groups must use a distinct, stable account for this purpose. An organizer’s
personal login may administer a group but must not silently become the
publisher account for newly created public group records.

## Alternatives considered

- **Organizer-owned records:** rejected because a co-organized group loses
  continuity when its original organizer leaves or changes account.
- **One DevRelish-owned central account:** rejected because it centralizes
  custody and does not give each group a portable public identity.
- **DevRelish-operated PDS:** rejected for the initial relaunch because it is
  unnecessary and adds cost and operational responsibility. It remains an
  option if product requirements later make it worthwhile.

## Consequences

- The product needs an explicit group-account connection and authorization
  flow, rather than treating an organizer session as the group repository.
- Publication, edits, and deletion need a retryable outbox and reconciliation
  process; best-effort mirroring is insufficient.
- Existing organizer-authored records need a documented migration path and
  must remain readable during the transition.
- An existing compatible PDS is sufficient. Availability, account recovery,
  and the PDS operator’s policies are the group’s trade-offs when choosing one.
