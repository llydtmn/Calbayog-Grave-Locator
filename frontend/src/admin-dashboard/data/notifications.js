// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS SEED — sent broadcast log + stats for the Notifications page.
// ─────────────────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPES = ['Memorial Update', 'Announcement', 'System Alert']

export const SENT_NOTIFICATIONS = [
  { id: 'notif-1', unread: true, title: 'Memorial approved — Elena Lim', body: 'The submission for Block 7, Lot 405 was approved and is now live.', sentAt: '2026-03-04T10:00:00' },
  { id: 'notif-2', unread: true, title: 'New user registered — Luz Bautista', body: 'A new account was created and linked to Block 5, Lot 318.', sentAt: '2026-03-04T05:00:00' },
  { id: 'notif-3', unread: false, title: 'Holiday closure announcement', body: 'Sent to all users. Cemetery closed March 8, 2026.', sentAt: '2026-03-03T09:00:00' },
  { id: 'notif-4', unread: false, title: 'Lot status updated — Block 6, Lot 231', body: 'Marked as Reserve Lot by admin.', sentAt: '2026-03-02T14:00:00' },
]

export const NOTIFICATION_STATS = {
  sentToday: 12,
  sentThisWeek: 48,
  usersReached: 348,
  openRate: 0.72,
}

export const SYSTEM_ALERTS = [
  { id: 'alert-1', level: 'warning', message: '2 memorial submissions awaiting review' },
  { id: 'alert-2', level: 'ok', message: 'System backup completed' },
]
