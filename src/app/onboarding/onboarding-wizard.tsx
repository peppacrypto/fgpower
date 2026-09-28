"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { formatDuration } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { actionFailure, describeActionFailure, runAction } from "@/components/social/run-action";
import { ActionErrorText } from "@/components/social/session-expired";
import { completeOnboarding, type OnboardingFormState } from "@/lib/actions/onboarding";
import { checkUsername, suggestUsername } from "@/lib/actions/profile";
import { FAT_LOSS_NOTE } from "@/lib/constants/program-labels";
import { publicProfileLabel, slugifyUsername, usernameError, USERNAME_RULE } from "@/lib/validation/username";
import { STEP_REASONS, TOTAL_STEPS } from "./steps";
import { DaysMatchNote, WeekdayChips } from "./weekday-chips";
import { INVALID_FIELD } from "@/app/app/settings/save-status";

const GOALS = [
  { value: "HYPERTROPHY", label: "Hipertrofia", desc: "Ganhar massa muscular" },
  { value: "STRENGTH", label: "Força", desc: "Levantar mais peso" },
  { value: "FAT_LOSS", label: "Emagrecer / definir", desc: "Perder gordura sem perder músculo" },
  { value: "GENERAL_FITNESS", label: "Fitness geral", desc: "Saúde e condicionamento" },
  { value: "STRENGTH_HYPERTROPHY", label: "Força + Hipertrofia", desc: "Os dois objetivos" },
  { value: "SPORTS_PERFORMANCE", label: "Performance esportiva", desc: "Para outro esporte" },
];

const EXPERIENCE = [
  { value: "BEGINNER", label: "Iniciante", desc: "Menos de 1 ano de treino" },
  { value: "INTERMEDIATE", label: "Intermediário", desc: "1 a 3 anos" },
  { value: "ADVANCED", label: "Avançado", desc: "3+ anos consistentes" },
];

const EQUIPMENT = [
  { value: "FULL_GYM", label: "Academia completa", desc: "Barras, halteres, máquinas e cabos" },
  { value: "HOME_DUMBBELLS", label: "Halteres em casa", desc: "Halteres e talvez um banco" },
  { value: "HOME_BODYWEIGHT", label: "Só peso do corpo", desc: "Sem equipamento, ou só uma barra fixa" },
  { value: "MINIMAL", label: "Equipamento mínimo", desc: "Faixas elásticas, kettlebell etc." },
];

const SESSION_MINUTES = [30, 45, 60, 75, 90, 120];

/** Review: resistance training + protein preserve muscle while a diet does the losing. */
const FAT_LOSS_EVIDENCE_URL = "https://doi.org/10.3945/an.116.014506";

interface Answers {
  displayName: string;
  username: string;
  /** True while `username` is still our suggestion (follows the name as it's typed). */
  usernameAuto: boolean;
  goal: string;
  experience: string;
  daysPerWeek: number;
  sessionMinutes: number;
  preferredDays: number[];
  equipmentAccess: string;
  doesEndurance: boolean;
  enduranceNotes: string;
  limitations: string;
}

type UsernameCheck =
  | { value: string; status: "checking" }
  | { value: string; status: "ok" }
  | { value: string; status: "error"; message: string };

const initialState: OnboardingFormState = {};

// Step headings are script focus targets, not controls: no focus ring (inline
// so it beats the global :focus-visible rule).
const FOCUS_TARGET = { outline: "none" } as const;

const MONO = "font-mono text-[11px] font-bold uppercase tracking-[0.12em]";

function stepFromLocation(): number {
  const passo = Number(new URLSearchParams(window.location.search).get("passo"));
  return Number.isInteger(passo) && passo >= 1 && passo <= TOTAL_STEPS ? passo - 1 : 0;
}

/** Keeps only well-typed fields from a stored draft (sessionStorage can hold anything). */
function sanitizeDraft(raw: unknown, base: Answers): Answers {
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown, max: number, fallback: string) => (typeof v === "string" ? v.slice(0, max) : fallback);
  const oneOf = (v: unknown, options: { value: string }[], fallback: string) =>
    typeof v === "string" && options.some((o) => o.value === v) ? v : fallback;
  const int = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : fallback;
  return {
    displayName: str(d.displayName, 60, base.displayName),
    username: str(d.username, 24, base.username),
    usernameAuto: typeof d.usernameAuto === "boolean" ? d.usernameAuto : base.usernameAuto,
    goal: oneOf(d.goal, GOALS, base.goal),
    experience: oneOf(d.experience, EXPERIENCE, base.experience),
    daysPerWeek: int(d.daysPerWeek, 1, 7, base.daysPerWeek),
    sessionMinutes: int(d.sessionMinutes, 15, 180, base.sessionMinutes),
    preferredDays: Array.isArray(d.preferredDays)
      ? [...new Set(d.preferredDays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))]
      : base.preferredDays,
    equipmentAccess: oneOf(d.equipmentAccess, EQUIPMENT, base.equipmentAccess),
    doesEndurance: typeof d.doesEndurance === "boolean" ? d.doesEndurance : base.doesEndurance,
    enduranceNotes: str(d.enduranceNotes, 300, base.enduranceNotes),
    limitations: str(d.limitations, 500, base.limitations),
  };
}

export function OnboardingWizard({
  userId,
  defaultName,
  defaultUsername,
  hasHandle,
  publicOrigin,
  next,
  initialStep,
}: {
  userId: string;
  /** First name from the Google account. */
  defaultName: string;
  /** The user's handle, or a free one suggested from `defaultName`. */
  defaultUsername: string;
  /** Whether `defaultUsername` is already theirs (then it doesn't follow the name). */
  hasHandle: boolean;
  publicOrigin: string;
  /** Validated app path to land on at the end (where sign-in started). */
  next: string | null;
  initialStep: number;
}) {
  const [answers, setAnswers] = useState<Answers>({
    displayName: defaultName,
    username: defaultUsername,
    usernameAuto: !hasHandle,
    goal: "HYPERTROPHY",
    experience: "BEGINNER",
    daysPerWeek: 3,
    sessionMinutes: 60,
    preferredDays: [],
    equipmentAccess: "FULL_GYM",
    doesEndurance: false,
    enduranceNotes: "",
    limitations: "",
  });
  const [step, setStep] = useState(initialStep);
  const [nameError, setNameError] = useState(false);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck | null>(null);
  const storageKey = `fgpower:onboarding:${userId}`;

  function update(patch: Partial<Answers>) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  // --- Answers survive back/forward, reloads and a re-login (this tab only).
  // Nothing is written until the stored draft has been applied, so the
  // defaults of the first render never overwrite it.
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    let draft: unknown = null;
    try {
      const raw = sessionStorage.getItem(storageKey);
      draft = raw ? JSON.parse(raw) : null;
    } catch {
      // Storage blocked or corrupt: start from the defaults.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a sessionStorage draft, only readable after hydration
    if (draft) setAnswers((a) => sanitizeDraft(draft, a));
    setDraftLoaded(true);
  }, [storageKey]);

  const answersRef = useRef(answers);
  const saveDraft = useCallback(
    (a: Answers) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(a));
      } catch {
        // Private mode / quota: the wizard still works, it just won't survive a reload.
      }
    },
    [storageKey],
  );
  useEffect(() => {
    answersRef.current = answers;
    if (draftLoaded) saveDraft(answers);
  }, [answers, draftLoaded, saveDraft]);

  // --- The step lives in the URL (?passo=2), so the phone's back gesture
  // walks back through the questions instead of leaving the wizard.
  const focusStep = useRef(false);
  useEffect(() => {
    function onPopState() {
      focusStep.current = true;
      setStep(stepFromLocation());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Step headings take focus when the step changes, so screen readers and the
  // phone keyboard (which closes) both land on the new question.
  useEffect(() => {
    if (!focusStep.current) return;
    focusStep.current = false;
    document.getElementById(`onboarding-step-${step}`)?.focus();
  }, [step]);

  function showStep(n: number, mode: "push" | "replace") {
    focusStep.current = true;
    setStep(n);
    const params = new URLSearchParams(window.location.search);
    if (n === 0) params.delete("passo");
    else params.set("passo", String(n + 1));
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}`;
    // A fresh state object lets Next.js's router pick up the new URL; the flag
    // marks entries whose previous entry is the previous step.
    if (mode === "push") window.history.pushState({ fgOnboarding: true }, "", url);
    else window.history.replaceState({ fgOnboarding: Boolean(window.history.state?.fgOnboarding) }, "", url);
  }

  // --- @usuário: follows the name (with a free variant from the server) until
  // the user types their own, which is then checked as they go.
  const usernameLocalError = answers.username.trim() === "" ? null : usernameError(answers.username);
  // Free handles the server already found, by name (the page resolved the
  // Google first name's).
  const suggestions = useRef(new Map(hasHandle ? [] : [[defaultName, defaultUsername]]));
  useEffect(() => {
    if (!answers.usernameAuto) return;
    const name = answers.displayName;
    if (name.trim() === "" || suggestions.current.has(name)) return;
    const timer = setTimeout(async () => {
      const result = await runAction(() => suggestUsername(name));
      if (!result.ok) return; // keep the local slug; the server resolves collisions at the end
      suggestions.current.set(name, result.username);
      setAnswers((a) => (a.usernameAuto && a.displayName === name ? { ...a, username: result.username } : a));
    }, 400);
    return () => clearTimeout(timer);
  }, [answers.displayName, answers.usernameAuto]);

  useEffect(() => {
    const value = answers.username.trim();
    if (answers.usernameAuto || value === "" || usernameLocalError) return;
    // Their own handle (kept from before) needs no check.
    if (hasHandle && value.toLowerCase() === defaultUsername.toLowerCase()) return;
    const timer = setTimeout(async () => {
      setUsernameCheck({ value, status: "checking" });
      const result = await runAction(() => checkUsername(value));
      if (result.ok) setUsernameCheck({ value, status: "ok" });
      // Offline / server hiccup: say nothing — the final save checks again.
      else if (result.error !== actionFailure().error) setUsernameCheck({ value, status: "error", message: result.error });
      else setUsernameCheck(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [answers.username, answers.usernameAuto, usernameLocalError, hasHandle, defaultUsername]);

  function onNameChange(value: string) {
    setNameError(false);
    // Instant local slug; the debounced server suggestion replaces it with a free one.
    const handle = suggestions.current.get(value) ?? slugifyUsername(value);
    setAnswers((a) => ({
      ...a,
      displayName: value,
      username: a.usernameAuto && value.trim() !== "" ? handle : a.username,
    }));
  }

  function onUsernameChange(value: string) {
    setUsernameCheck(null);
    update({ username: value.replace(/^@+/, ""), usernameAuto: false });
  }

  const typedUsername = answers.username.trim();
  const usernameProblem = !answers.usernameAuto
    ? (usernameLocalError ??
      (usernameCheck?.status === "error" && usernameCheck.value === typedUsername ? usernameCheck.message : null))
    : null;

  // --- Submit: a client wrapper so a dropped connection stays an inline
  // message (the draft is kept) instead of the error page.
  const [state, formAction, pending] = useActionState(
    async (prev: OnboardingFormState, formData: FormData): Promise<OnboardingFormState> => {
      // The draft (limitations included) shouldn't outlive the wizard; it's
      // written back below if the save doesn't go through.
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Storage blocked: nothing was saved either.
      }
      try {
        const result = await completeOnboarding(prev, formData);
        // Only reached on failure: success redirects.
        saveDraft(answersRef.current);
        if (result.fieldErrors?.displayName || result.fieldErrors?.username) {
          showStep(0, "replace");
        }
        return result;
      } catch (err) {
        unstable_rethrow(err); // the success redirect
        console.warn("completeOnboarding failed", err);
        saveDraft(answersRef.current);
        return { error: (await describeActionFailure()).error };
      }
    },
    initialState,
  );

  // Step 0 requires a name and, if one was typed, a usable handle. Gate it
  // here — step 0's inputs are hidden on later steps, so a server error there
  // would only surface at the very end.
  function goNext() {
    if (step === 0) {
      if (answers.displayName.trim() === "") {
        setNameError(true);
        document.getElementById("displayName")?.focus();
        return;
      }
      if (usernameProblem) {
        document.getElementById("username")?.focus();
        return;
      }
    }
    showStep(Math.min(TOTAL_STEPS - 1, step + 1), "push");
  }

  function goBack() {
    if (window.history.state?.fgOnboarding) window.history.back();
    else showStep(Math.max(0, step - 1), "replace");
  }

  // Enter / "Ir" in a text field triggers the browser's implicit form
  // submission. Before the last step that must mean "next", never "finish
  // with the defaults of every step the user hasn't seen".
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (step < TOTAL_STEPS - 1) {
      e.preventDefault();
      goNext();
    }
  }
  // Step 1 has two text fields and no submit button, and then browsers skip
  // implicit submission altogether — so Enter is handled here, the same way.
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || !(e.target instanceof HTMLInputElement)) return;
    if (step < TOTAL_STEPS - 1) {
      e.preventDefault();
      goNext();
    }
  }

  const displayNameError = nameError ? "Informe seu nome para continuar." : state.fieldErrors?.displayName;
  const usernameMessage = usernameProblem ?? state.fieldErrors?.username ?? null;
  const shownHandle = typedUsername || "seu_usuario";
  const checked = !answers.usernameAuto && usernameCheck?.value === typedUsername ? usernameCheck.status : null;
  const usernameStatus = usernameMessage ? (
    <span className="font-medium text-danger">
      <ActionErrorText error={usernameMessage} />
    </span>
  ) : checked === "checking" ? (
    <span className={cn(MONO, "text-[10px] text-muted")}>Verificando…</span>
  ) : checked === "ok" ? (
    <span className={cn(MONO, "text-[10px] text-success")}>Disponível ✓</span>
  ) : null;

  return (
    <form action={formAction} onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate className="w-full max-w-lg">
      <div
        role="progressbar"
        aria-label={`Passo ${step + 1} de ${TOTAL_STEPS}`}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step + 1}
        aria-valuetext={`Passo ${step + 1} de ${TOTAL_STEPS}`}
        className="grid grid-cols-4 gap-1.5"
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={cn("h-1.5 transition-colors duration-300", i <= step ? "bg-accent" : "bg-border")}
          />
        ))}
      </div>
      <p className={cn(MONO, "mt-3 text-muted")}>
        <span className="text-accent">
          Passo {step + 1}/{TOTAL_STEPS}
        </span>{" "}
        · {STEP_REASONS[step]}
      </p>

      {state.error ? (
        <p role="alert" className="mt-5 border-l-2 border-l-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
          <ActionErrorText error={state.error} />
        </p>
      ) : null}

      {/* Step 1 — name + public handle */}
      <fieldset hidden={step !== 0} className="mt-6 flex flex-col gap-5">
        <legend className="contents">
          <h1 id="onboarding-step-0" tabIndex={-1} style={FOCUS_TARGET} className="text-2xl font-bold tracking-tight">
            Como podemos te chamar?
          </h1>
        </legend>
        <div>
          <Label htmlFor="displayName">Nome de exibição</Label>
          <Input
            id="displayName"
            name="displayName"
            placeholder="Ex.: Guilherme"
            required
            className={cn("mt-1.5", INVALID_FIELD)}
            maxLength={60}
            autoComplete="given-name"
            enterKeyHint="next"
            value={answers.displayName}
            onChange={(e) => onNameChange(e.target.value)}
            aria-invalid={displayNameError ? true : undefined}
            aria-describedby={displayNameError ? "displayName-error displayName-hint" : "displayName-hint"}
          />
          {displayNameError ? (
            <p id="displayName-error" role="alert" className="mt-1 text-xs font-medium text-danger">
              {displayNameError}
            </p>
          ) : null}
          <p id="displayName-hint" className="mt-1 text-xs text-muted">
            É assim que outras pessoas veem você no feed e no seu perfil.
          </p>
        </div>

        <div>
          <Label htmlFor="username">Seu @usuário (opcional)</Label>
          <p id="username-rule" className="mt-0.5 text-xs text-muted">
            {USERNAME_RULE}. Em branco, criamos um a partir do seu nome.
          </p>
          <div className="mt-1.5 flex">
            <span
              aria-hidden
              className="flex items-center rounded-l-[3px] border border-r-0 border-foreground/50 bg-surface-2 px-3 font-mono text-sm text-muted"
            >
              @
            </span>
            <Input
              id="username"
              name="username"
              value={answers.username}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="seu_usuario"
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={usernameMessage ? true : undefined}
              aria-describedby="username-rule username-status username-preview"
              className={cn("rounded-l-none", INVALID_FIELD)}
            />
          </div>
          <input type="hidden" name="usernameAuto" value={answers.usernameAuto ? "1" : "0"} />
          {/* Only the check result is live; the link preview beside it changes
              with every keystroke of the name and would be read out each time. */}
          <p className="mt-1 min-h-4 text-xs">
            <span id="username-status" aria-live="polite">
              {usernameStatus}
            </span>
            {usernameStatus ? null : (
              <span id="username-preview" className="font-mono text-muted">
                {publicProfileLabel(shownHandle, publicOrigin)}
              </span>
            )}
          </p>
        </div>
      </fieldset>

      {/* Step 2 — goal */}
      <fieldset hidden={step !== 1} className="mt-6 flex flex-col gap-4">
        <legend className="contents">
          <h1 id="onboarding-step-1" tabIndex={-1} style={FOCUS_TARGET} className="text-2xl font-bold tracking-tight">
            Qual é o seu principal objetivo?
          </h1>
        </legend>
        <RadioCards name="goal" options={GOALS} value={answers.goal} onChange={(goal) => update({ goal })} />
        <div aria-live="polite">
          {answers.goal === "FAT_LOSS" ? (
            <div className="border-l-2 border-l-accent bg-surface-2 px-3.5 py-3 text-sm">
              <p className="font-semibold">{FAT_LOSS_NOTE}</p>
              <p className="mt-1 text-muted">
                {/* What the recommender does (recommend.ts): a lifting plan at the level asked next, not cardio. */}
                Vamos sugerir um programa de musculação do seu nível, para fazer junto com a dieta.{" "}
                <a
                  href={FAT_LOSS_EVIDENCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2"
                >
                  Ver a evidência ↗
                </a>
              </p>
            </div>
          ) : null}
        </div>
      </fieldset>

      {/* Step 3 — experience + frequency */}
      <div hidden={step !== 2} className="mt-6 flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <h1 id="onboarding-step-2" tabIndex={-1} style={FOCUS_TARGET} className="text-2xl font-bold tracking-tight">
              Qual sua experiência com treino?
            </h1>
          </legend>
          <RadioCards
            name="experience"
            options={EXPERIENCE}
            value={answers.experience}
            onChange={(experience) => update({ experience })}
          />
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className={cn(MONO, "mb-3 text-muted")}>Rotina</legend>
          {/* Side by side from 360px; stacked below, where "~1 h 15 min" would be cut. */}
          <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
            <div>
              <Label htmlFor="daysPerWeek">Dias por semana</Label>
              <Select
                id="daysPerWeek"
                name="daysPerWeek"
                value={answers.daysPerWeek}
                onChange={(e) => update({ daysPerWeek: Number(e.target.value) })}
                className="mt-1.5"
              >
                {/* The label already says "por semana": "3 dias" fits a half-width select. */}
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1 dia" : `${d} dias`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="sessionMinutes">Duração da sessão</Label>
              <Select
                id="sessionMinutes"
                name="sessionMinutes"
                value={answers.sessionMinutes}
                onChange={(e) => update({ sessionMinutes: Number(e.target.value) })}
                className="mt-1.5"
              >
                {SESSION_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    ~{formatDuration(m * 60)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Dias preferidos (opcional)</legend>
            <div className="mt-2">
              <WeekdayChips
                value={answers.preferredDays}
                onToggle={(day) =>
                  setAnswers((a) => ({
                    ...a,
                    preferredDays: a.preferredDays.includes(day)
                      ? a.preferredDays.filter((d) => d !== day)
                      : [...a.preferredDays, day].sort((x, y) => x - y),
                  }))
                }
              />
            </div>
            <DaysMatchNote
              daysPerWeek={answers.daysPerWeek}
              preferredCount={answers.preferredDays.length}
              onUseCount={() => update({ daysPerWeek: answers.preferredDays.length })}
            />
            {answers.preferredDays.map((d) => (
              <input key={d} type="hidden" name="preferredDays" value={d} />
            ))}
          </fieldset>
        </fieldset>
      </div>

      {/* Step 4 — equipment + optional */}
      <div hidden={step !== 3} className="mt-6 flex flex-col gap-6">
        <fieldset className="flex flex-col gap-4">
          <legend className="contents">
            <h1 id="onboarding-step-3" tabIndex={-1} style={FOCUS_TARGET} className="text-2xl font-bold tracking-tight">
              Onde você vai treinar?
            </h1>
          </legend>
          <RadioCards
            name="equipmentAccess"
            options={EQUIPMENT}
            value={answers.equipmentAccess}
            onChange={(equipmentAccess) => update({ equipmentAccess })}
          />
        </fieldset>

        <div>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              name="doesEndurance"
              checked={answers.doesEndurance}
              onChange={(e) => update({ doesEndurance: e.target.checked })}
              className="size-4 shrink-0 accent-accent"
            />
            Também treino resistência/endurance (corrida, ciclismo etc.)
          </label>
          {answers.doesEndurance ? (
            <Textarea
              name="enduranceNotes"
              aria-label="Detalhes do treino de endurance"
              placeholder="Ex.: corro 3x por semana, treinando para uma meia-maratona"
              maxLength={300}
              rows={2}
              value={answers.enduranceNotes}
              onChange={(e) => update({ enduranceNotes: e.target.value })}
              className="mt-2"
            />
          ) : null}
        </div>

        <div>
          <Label htmlFor="limitations">Limitações ou exercícios a evitar (opcional)</Label>
          <Textarea
            id="limitations"
            name="limitations"
            placeholder="Ex.: evitar agachamento profundo por causa do joelho"
            maxLength={500}
            value={answers.limitations}
            onChange={(e) => update({ limitations: e.target.value })}
            aria-describedby="limitations-hint"
            className="mt-1.5"
          />
          <p id="limitations-hint" className="mt-1.5 text-xs text-muted">
            A FGPOWER não é um serviço de diagnóstico médico. Para lesões, consulte um profissional de saúde.
          </p>
        </div>
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="mt-8 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={goBack} className={step === 0 ? "invisible" : ""}>
          Voltar
        </Button>
        {step < TOTAL_STEPS - 1 ? (
          // key differs from the submit button below so React always mounts
          // a fresh DOM node when switching — reusing the same <button> node
          // while patching type="button" -> type="submit" mid-click can make
          // the browser apply the new type's default action (form submit)
          // to the very click that triggered the swap.
          <Button key="continue" type="button" onClick={goNext}>
            Continuar
          </Button>
        ) : (
          <Button key="submit" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Ver meu plano"}
          </Button>
        )}
      </div>
    </form>
  );
}

function RadioCards({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string; desc: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-3 rounded-[3px] border px-4 py-3.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
            // The picked card carries the accent keel on its left edge, not only a tint.
            value === opt.value ? "border-accent bg-accent-soft shadow-[inset_3px_0_0_var(--accent)]" : "border-border hover:bg-surface-2",
          )}
        >
          <span>
            <span className="block font-semibold">{opt.label}</span>
            <span className="block text-xs text-muted">{opt.desc}</span>
          </span>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="size-4 shrink-0 accent-accent"
          />
        </label>
      ))}
    </div>
  );
}
