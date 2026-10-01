"use client";

import { useState } from "react";
import { FollowButton, type FollowButtonProps } from "@/components/social/follow-button";

/**
 * The author's FollowButton for someone who holds only the link (W-008):
 * offered when they neither follow the author nor asked to — and, once on
 * screen, kept there. A server re-render (better-auth's session refresh, a
 * later action) brings the new relation; dropping the button then would take
 * "Solicitação enviada" or "Seguindo" away right after the tap (R5). The
 * button keeps what its tap settled instead.
 */
export function FollowAuthor(props: FollowButtonProps) {
  // Decided by the first render only: later renders never unmount the button.
  const [offered] = useState(props.initialRelation === "NONE");
  return offered ? <FollowButton {...props} /> : <span />;
}
