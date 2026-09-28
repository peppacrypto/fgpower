"use client";

/**
 * The "⋯" menu on someone else's profile (/u, signed in, not the owner; W-141
 * B): "Remover dos seguidores" (when they follow the viewer), "Denunciar
 * perfil" (ReportSheet), "Bloquear @x" (ConfirmSheet → blockUser, then
 * /app/settings?bloqueado=1#bloqueados). Owned by the social inbox cluster
 * (C1); rendered by /u (C2) next to the FollowButton. No item may contain the
 * text "FG" (e2e 09 finds the only /FG/ button on /u).
 *
 * Phase 0 stub with the final props: renders nothing yet.
 */
export interface ProfileMenuProps {
  user: { id: string; username: string | null; name: string };
  /** They follow the viewer: offer "Remover dos seguidores". */
  followsViewer: boolean;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Phase 0 stub (C1 implements W-141)
export function ProfileMenu(props: ProfileMenuProps) {
  return null;
}
