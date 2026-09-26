import Link from "next/link";
import { Button } from "@/components/ui/button";

/** /u/<handle> that doesn't exist or isn't visible to this viewer. */
export default function ProfileNotFound() {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <title>Perfil não encontrado · FGPOWER</title>
      <div className="panel-raised px-5 py-7">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-muted">404 · Perfil</span>
        <h1 className="text-display mt-2 text-2xl font-extrabold">Perfil não encontrado ou publicação privada.</h1>
        <p className="mt-2 text-sm text-muted">
          O @usuário pode ter mudado, ou o perfil só aparece para quem segue. Entre para ver o que é seu e de quem você
          segue.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button variant="strong" className="sm:flex-1" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button variant="outline" className="sm:flex-1" asChild>
            <Link href="/">Início</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
