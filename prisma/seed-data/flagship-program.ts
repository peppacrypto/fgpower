export interface FlagshipExercise {
  exerciseSlug: string;
  alternativeSlugs?: string[];
  sets: number;
  repMin: number;
  repMax: number;
  rirTarget: number;
  restSeconds: number;
  warmupSets?: number;
  notesEn?: string;
  notesPt?: string;
}

export interface FlagshipDay {
  dayIndex: number;
  nameEn: string;
  namePt: string;
  focusEn: string;
  focusPt: string;
  estimatedMinutes: number;
  exercises: FlagshipExercise[];
}

export const FLAGSHIP_PROGRAM = {
  slug: "fgpower-adaptation",
  version: 1,
  nameEn: "FGPOWER Adaptation — Lower Strength + Upper Hypertrophy",
  namePt: "Adaptação FGPOWER — Força de Perna + Hipertrofia de Superior",
  taglineEn: "A 4-week on-ramp for lower-body strength and upper-body hypertrophy, 3x/week.",
  taglinePt: "Uma progressão de 4 semanas para força de perna e hipertrofia de superior, 3x/semana.",
  descriptionEn: `A four-week adaptation block for someone beginning or returning to resistance training while maintaining endurance training. Built to control early fatigue and neuromuscular learning curve rather than testing your limits on day one.`,
  descriptionPt: `Um bloco de adaptação de quatro semanas para quem está começando ou retornando ao treino de força, mantendo o treino de resistência (endurance) em paralelo. Construído para controlar a fadiga inicial e a curva de aprendizado neuromuscular, em vez de testar seus limites logo no primeiro dia.`,
  audienceEn: "Beginners, and anyone returning to structured strength training after a break — including people who also run, cycle, or do other endurance work.",
  audiencePt: "Iniciantes, e qualquer pessoa retornando ao treino de força estruturado após uma pausa — incluindo quem também corre, pedala ou faz outro trabalho de resistência.",
  goal: "STRENGTH_HYPERTROPHY",
  experienceLevel: "BEGINNER",
  daysPerWeek: 3,
  durationWeeks: 4,
  sessionMinutes: 60,
  equipmentAccess: "FULL_GYM",
  trainingStyle: "HYBRID",
  progressionStrategy: "DOUBLE",
  isFlagship: true,
  rationaleEn: `**Why 2x/week lower body, 3x/week distributed upper body?** Training frequency research shows training a muscle group twice weekly outperforms once weekly at equal volume, while the strength-focused evidence suggests the raw frequency effect is largely a proxy for the extra volume more frequent training makes possible. Lower-body work is demanding to recover from, so it sits at 2 focused sessions; upper-body volume is spread across all 3 sessions since it recovers faster and benefits from more total touches per week.

**Why not train to failure?** Multiple systematic reviews find training to failure isn't required for strength or hypertrophy once volume is equated, and it adds disproportionate fatigue and recovery cost — a bad trade during an adaptation block where technique and consistency matter more than grinding out every last rep.

**Why the 4-week ramp instead of jumping straight to full volume?** Early strength gains come mostly from the nervous system learning the movement, not from a testable maximum on day one; a study following untrained lifters found real strength only caught up to early size changes by week 10, and some very-early "growth" likely reflects exercise-induced swelling rather than genuine new muscle. Starting at a lower RIR-target intensity (more reps in reserve) and fewer sets, then ramping both up over 4 weeks, respects that timeline.

**Why double progression?** It gives an unambiguous, self-explaining signal for when to add load — you know it's time once every working set reaches the top of its rep range at the target RIR — rather than requiring guesswork or a fixed schedule regardless of actual performance.`,
  rationalePt: `**Por que 2x/semana de perna e 3x/semana de superior distribuído?** As pesquisas sobre frequência de treino mostram que treinar um grupo muscular duas vezes por semana supera uma vez por semana com o mesmo volume, enquanto a evidência focada em força sugere que o efeito bruto da frequência é, em grande parte, um proxy para o volume extra que uma frequência maior possibilita. O treino de perna é exigente para recuperar, então fica com 2 sessões focadas; o volume de superior é distribuído nas 3 sessões, já que recupera mais rápido e se beneficia de mais estímulos por semana.

**Por que não treinar até a falha?** Diversas revisões sistemáticas encontram que treinar até a falha não é necessário para força ou hipertrofia quando o volume é equalizado, e adiciona fadiga e custo de recuperação desproporcionais — uma troca ruim durante um bloco de adaptação, onde técnica e consistência importam mais do que espremer cada última repetição.

**Por que a progressão de 4 semanas em vez de ir direto ao volume total?** Os ganhos iniciais de força vêm principalmente do sistema nervoso aprendendo o movimento, não de um máximo testável no primeiro dia; um estudo acompanhando praticantes não treinados encontrou que a força real só alcançou as mudanças iniciais de tamanho na semana 10, e parte do "crescimento" muito inicial provavelmente reflete inchaço induzido pelo exercício, não músculo novo genuíno. Começar com um alvo de RIR mais alto (mais repetições em reserva) e menos séries, aumentando os dois ao longo de 4 semanas, respeita essa linha do tempo.

**Por que progressão dupla?** Ela dá um sinal claro e autoexplicativo de quando adicionar carga — você sabe que é hora quando toda série de trabalho atinge o topo da sua faixa de repetições no RIR-alvo — em vez de exigir adivinhação ou um cronograma fixo, independente do desempenho real.`,
  restGuidanceEn: "2-3 minutes for primary compound lifts, 90-120 seconds for isolation work.",
  restGuidancePt: "2 a 3 minutos para os exercícios compostos principais, 90 a 120 segundos para os exercícios de isolamento.",
  weeklyGuidance: [
    {
      week: 1,
      rirTarget: 4,
      setsNote: "Use only 2 working sets for exercises normally prescribed with 3+.",
      setsNotePt: "Use apenas 2 séries de trabalho nos exercícios normalmente prescritos com 3 ou mais.",
      noteEn: "Focus on technique. No 1RM testing.",
      notePt: "Foco em técnica. Sem teste de 1RM.",
    },
    {
      week: 2,
      rirTarget: 3,
      setsNote: "2-3 working sets.",
      setsNotePt: "2 a 3 séries de trabalho.",
      noteEn: "Slight progressive overload where technique is solid.",
      notePt: "Leve sobrecarga progressiva onde a técnica já está sólida.",
    },
    {
      week: 3,
      rirTarget: 2.5,
      setsNote: "Full programmed set volume.",
      setsNotePt: "Volume de séries programado completo.",
      noteEn: "",
      notePt: "",
    },
    {
      week: 4,
      rirTarget: 2,
      setsNote: "Full volume. Primary lower-body movements can progress toward 5-6 reps.",
      setsNotePt: "Volume completo. Os movimentos principais de perna podem progredir para 5-6 repetições.",
      noteEn: "Still no 1RM testing — save that for after this block.",
      notePt: "Ainda sem teste de 1RM — deixe isso para depois deste bloco.",
    },
  ],
  evidenceKeys: [
    "schoenfeld-2016-frequency-hypertrophy",
    "grgic-2018-frequency-strength",
    "grgic-2022-failure-vs-nonfailure",
    "vieira-2021-failure-vs-nonfailure",
    "folland-williams-2007-adaptations-strength-training",
    "damas-2016-early-hypertrophy-edema-swelling",
    "plotkin-2022-load-vs-rep-progression",
    "acsm-2009-progression-models-position-stand",
  ],
  principleSlugs: [
    "training-frequency",
    "training-to-failure",
    "beginner-adaptation",
    "double-progression",
    "rir",
    "rest-intervals",
  ],
  days: [
    {
      dayIndex: 0,
      nameEn: "Session A",
      namePt: "Sessão A",
      focusEn: "Lower strength + upper hypertrophy",
      focusPt: "Força de perna + hipertrofia de superior",
      estimatedMinutes: 65,
      exercises: [
        { exerciseSlug: "hack-squat", alternativeSlugs: ["barbell-squat"], sets: 3, repMin: 6, repMax: 8, rirTarget: 2, restSeconds: 150, warmupSets: 2 },
        { exerciseSlug: "romanian-deadlift", sets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSeconds: 150, warmupSets: 1 },
        { exerciseSlug: "barbell-bench-press-medium-grip", sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 150, warmupSets: 1 },
        { exerciseSlug: "wide-grip-lat-pulldown", sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120 },
        { exerciseSlug: "lying-t-bar-row", sets: 2, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, notesEn: "Chest-supported row.", notesPt: "Remada com apoio de peito." },
        { exerciseSlug: "side-lateral-raise", sets: 3, repMin: 12, repMax: 20, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "barbell-curl", sets: 2, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "triceps-pushdown", sets: 2, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
      ],
    },
    {
      dayIndex: 1,
      nameEn: "Session B",
      namePt: "Sessão B",
      focusEn: "Lower strength + upper hypertrophy",
      focusPt: "Força de perna + hipertrofia de superior",
      estimatedMinutes: 65,
      exercises: [
        { exerciseSlug: "leg-press", sets: 3, repMin: 6, repMax: 8, rirTarget: 2, restSeconds: 150, warmupSets: 2, notesEn: "45° leg press.", notesPt: "Leg press a 45°." },
        { exerciseSlug: "barbell-hip-thrust", sets: 2, repMin: 6, repMax: 8, rirTarget: 2, restSeconds: 150, warmupSets: 1 },
        { exerciseSlug: "seated-leg-curl", alternativeSlugs: ["lying-leg-curls"], sets: 2, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 90 },
        { exerciseSlug: "incline-dumbbell-press", alternativeSlugs: ["smith-machine-incline-bench-press"], sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, warmupSets: 1 },
        { exerciseSlug: "seated-cable-rows", sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120 },
        { exerciseSlug: "leverage-shoulder-press", sets: 2, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120 },
        { exerciseSlug: "side-lateral-raise", sets: 2, repMin: 12, repMax: 20, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "preacher-curl", sets: 2, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "triceps-pushdown-rope-attachment", sets: 2, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
      ],
    },
    {
      dayIndex: 2,
      nameEn: "Session C — Upper Body",
      namePt: "Sessão C — Superior",
      focusEn: "Upper hypertrophy",
      focusPt: "Hipertrofia de superior",
      estimatedMinutes: 60,
      exercises: [
        { exerciseSlug: "leverage-chest-press", sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, warmupSets: 1, notesEn: "Machine chest press.", notesPt: "Supino na máquina articulada." },
        { exerciseSlug: "lying-t-bar-row", sets: 3, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120 },
        { exerciseSlug: "close-grip-front-lat-pulldown", sets: 2, repMin: 8, repMax: 12, rirTarget: 2, restSeconds: 120, notesEn: "Neutral/close-grip lat pulldown.", notesPt: "Puxada com pegada fechada/neutra." },
        { exerciseSlug: "cable-crossover", alternativeSlugs: ["dumbbell-flyes"], sets: 2, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "side-lateral-raise", sets: 4, repMin: 12, repMax: 20, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "reverse-flyes", sets: 2, repMin: 12, repMax: 20, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "barbell-curl", sets: 3, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
        { exerciseSlug: "triceps-pushdown", sets: 3, repMin: 10, repMax: 15, rirTarget: 1, restSeconds: 90 },
      ],
    },
  ] satisfies FlagshipDay[],
};
