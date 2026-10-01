import { getBlockedUsers } from "@/lib/data/social";
import { Section } from "./section";
import { BlockedList } from "./blocked-list";

/**
 * Settings → "Contas bloqueadas" (id="bloqueados", after Privacidade; W-141):
 * who you blocked, with "Desbloquear". `notice` is the one-time "Conta
 * bloqueada." after blocking from a profile (?bloqueado=1).
 */
export async function BlockedSection({ userId, notice }: { userId: string; notice: boolean }) {
  const blocked = await getBlockedUsers(userId);
  return (
    <Section
      id="bloqueados"
      title="Contas bloqueadas"
      description="Vocês não veem o perfil nem os treinos um do outro, e quem foi bloqueado não é avisado."
    >
      <BlockedList people={blocked} notice={notice} />
    </Section>
  );
}
