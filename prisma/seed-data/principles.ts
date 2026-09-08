export interface PrincipleSeed {
  slug: string;
  titleEn: string;
  titlePt: string;
  summaryEn: string;
  summaryPt: string;
  bodyEn: string;
  bodyPt: string;
  sortOrder: number;
  evidenceKeys: string[];
}

export const PRINCIPLES: PrincipleSeed[] = [
  {
    slug: "rir",
    titleEn: "Repetitions in Reserve (RIR)",
    titlePt: "Repetições em Reserva (RIR)",
    summaryEn: "How close to muscular failure a set should be taken, expressed as an estimated number of reps left in the tank.",
    summaryPt: "O quão perto da falha muscular uma série deve ser levada, expresso como um número estimado de repetições que ainda restariam.",
    bodyEn: `RIR estimates how many more repetitions you could have performed at the end of a set. An RIR of 2 means "I could have done about 2 more good reps." It is closely related to Rate of Perceived Exertion (RPE), where RPE 8 corresponds to roughly 2 RIR.

A validity study found RIR-based RPE correlates strongly with actual bar-speed loss during squats in both experienced (r = -0.88) and novice (r = -0.77) lifters, supporting it as a practical way to gauge proximity to failure without needing velocity-tracking equipment.

**Does training closer to failure build more muscle?** The picture is nuanced. An exploratory meta-regression found hypertrophy outcomes trended better as sets were taken closer to failure, while strength outcomes did not meaningfully depend on RIR across a wide range — but the authors describe their models as exploratory, built on RIR values *estimated* from training descriptions rather than measured directly, with only modest statistical fit. A separate systematic review found a small, borderline-significant advantage for training to some definition of "set failure" over clearly stopping short, but no significant advantage for literal momentary failure specifically, and no clear extra benefit from very high velocity-loss thresholds versus moderate ones — suggesting the relationship is not simply "closer is always better."

**FGPOWER's approach:** most working sets in our programs target RIR 1-3. This leaves useful reps in reserve on most sets (supported by the failure vs. non-failure literature below), while still training with real, honest effort.`,
    bodyPt: `O RIR estima quantas repetições a mais você conseguiria fazer ao final de uma série. Um RIR de 2 significa "eu conseguiria fazer mais ou menos 2 repetições boas". Está diretamente relacionado ao RPE (Rate of Perceived Exertion), onde RPE 8 corresponde a aproximadamente 2 RIR.

Um estudo de validade encontrou correlação forte entre o RPE baseado em RIR e a perda real de velocidade da barra durante agachamentos, tanto em levantadores experientes (r = -0,88) quanto novatos (r = -0,77) — o que apoia o RIR como uma forma prática de estimar a proximidade da falha sem precisar de equipamento de medição de velocidade.

**Treinar mais perto da falha gera mais hipertrofia?** O quadro é nuançado. Uma meta-regressão exploratória encontrou uma tendência de melhores resultados de hipertrofia quanto mais perto da falha as séries eram levadas, enquanto os ganhos de força não dependeram de forma relevante do RIR em uma ampla faixa — mas os próprios autores descrevem seus modelos como exploratórios, construídos sobre valores de RIR *estimados* a partir de descrições de treino (não medidos diretamente), com ajuste estatístico apenas modesto. Uma revisão sistemática separada encontrou uma vantagem pequena e no limite da significância para treinar até alguma definição de "falha de série" em vez de parar claramente antes dela, mas nenhuma vantagem significativa para a falha muscular momentânea especificamente, e nenhum benefício extra claro de limiares de perda de velocidade muito altos versus moderados — sugerindo que a relação não é simplesmente "quanto mais perto, melhor".

**A abordagem da FGPOWER:** a maioria das séries de trabalho em nossos programas tem alvo de RIR 1 a 3. Isso deixa repetições úteis "na reserva" na maior parte das séries (apoiado pela literatura de falha vs. não-falha abaixo), mantendo ainda assim um esforço real e honesto no treino.`,
    sortOrder: 10,
    evidenceKeys: [
      "zourdos-2016-rir-rpe-scale-validity",
      "helms-2016-rir-rpe-application",
      "robinson-2024-proximity-to-failure-meta-regression",
      "refalo-2023-proximity-to-failure-hypertrophy",
    ],
  },
  {
    slug: "training-to-failure",
    titleEn: "Training to Failure",
    titlePt: "Treinar até a Falha",
    summaryEn: "Whether pushing a set all the way to muscular failure is necessary — the evidence says it usually isn't.",
    summaryPt: "Se é necessário levar uma série até a falha muscular completa — a evidência diz que geralmente não é.",
    bodyEn: `Across several systematic reviews comparing training to failure against stopping a rep or two short (with total volume equated between groups), the overall picture is consistent: **failure is not required** to build strength or size.

One meta-analysis of 15 studies found no significant overall difference between failure and non-failure training for strength or hypertrophy, though training to failure showed a small hypertrophy edge specifically in already-resistance-trained lifters. Another review of 13 studies found training to failure's apparent hypertrophy advantage disappeared once volume was properly equated between groups. A third review found a small effect favoring *non-failure* training for strength, unlikely to be practically meaningful.

Failure training also raises fatigue, soreness and session-to-session recovery cost, which can reduce the total volume you can sustain across a week — one of the reasons FGPOWER's default RIR targets sit at 1-3, not 0.

This is guidance, not a prohibition: occasional sets closer to or at failure (especially on isolation exercises, late in a training block) are a reasonable tool — just not the default for every set.`,
    bodyPt: `Em diversas revisões sistemáticas comparando treinar até a falha contra parar uma ou duas repetições antes (com o volume total equalizado entre os grupos), o quadro geral é consistente: **a falha não é necessária** para ganhar força ou massa muscular.

Uma meta-análise de 15 estudos não encontrou diferença geral significativa entre treinar com e sem falha para força ou hipertrofia, embora treinar até a falha tenha mostrado uma pequena vantagem de hipertrofia especificamente em praticantes já treinados. Outra revisão de 13 estudos encontrou que a aparente vantagem de hipertrofia do treino até a falha desaparecia quando o volume era corretamente equalizado entre os grupos. Uma terceira revisão encontrou um pequeno efeito favorecendo o treino *sem falha* para força, pouco provável de ser relevante na prática.

Treinar até a falha também aumenta a fadiga, a dor muscular e o custo de recuperação entre sessões, o que pode reduzir o volume total sustentável ao longo da semana — uma das razões pelas quais os alvos padrão de RIR da FGPOWER ficam entre 1 e 3, não em 0.

Isto é orientação, não uma proibição: séries ocasionais mais perto ou na falha (especialmente em exercícios de isolamento, no fim de um bloco de treino) são uma ferramenta razoável — só não o padrão para toda série.`,
    sortOrder: 20,
    evidenceKeys: [
      "grgic-2022-failure-vs-nonfailure",
      "vieira-2021-failure-vs-nonfailure",
      "davies-2016-failure-training-strength",
    ],
  },
  {
    slug: "progressive-overload",
    titleEn: "Progressive Overload",
    titlePt: "Sobrecarga Progressiva",
    summaryEn: "Gradually increasing the demand placed on a muscle over time — the foundational driver of long-term adaptation.",
    summaryPt: "Aumentar gradualmente a demanda imposta a um músculo ao longo do tempo — o motor fundamental da adaptação de longo prazo.",
    bodyEn: `Progressive overload is the principle that a muscle must face a demand it isn't already fully adapted to in order to keep adapting — whether through more load, more reps, more sets, or better execution.

The ACSM's position stand on resistance-training progression, an expert-consensus synthesis of the evidence available at the time, recommends structuring progression by training status: novices generally progress well on straightforward, unperiodized programs; advanced trainees benefit from more deliberate periodization. It remains a widely cited reference point, though some of its specific quantitative recommendations have since been refined by more recent meta-regressions.

An 8-week RCT comparing two ways to apply progressive overload — adding load at constant reps vs. adding reps at constant load — found load-progression produced slightly better strength gains, while rep-progression produced modestly better hypertrophy in one measured muscle, with most other differences small and inconclusive over the study's short duration.

**FGPOWER's approach:** every program specifies a progression strategy (usually double progression, see below) and the app tracks your logged performance against it automatically, so you always know when a genuine increase in demand is warranted — never guessing.`,
    bodyPt: `Sobrecarga progressiva é o princípio de que um músculo precisa enfrentar uma demanda à qual ainda não está totalmente adaptado para continuar se adaptando — seja por mais carga, mais repetições, mais séries ou melhor execução.

O posicionamento oficial do ACSM sobre progressão em treinamento de força, uma síntese de consenso de especialistas baseada na evidência disponível na época, recomenda estruturar a progressão de acordo com o nível de treino: iniciantes geralmente progridem bem com programas diretos e não periodizados; avançados se beneficiam de periodização mais deliberada. Continua sendo uma referência amplamente citada, embora algumas de suas recomendações quantitativas específicas tenham sido refinadas por meta-regressões mais recentes.

Um ensaio randomizado de 8 semanas comparando duas formas de aplicar sobrecarga progressiva — aumentar a carga com repetições constantes vs. aumentar as repetições com carga constante — encontrou que a progressão de carga produziu ganhos de força ligeiramente melhores, enquanto a progressão de repetições produziu hipertrofia modestamente melhor em um músculo medido, com a maioria das outras diferenças pequenas e inconclusivas ao longo da curta duração do estudo.

**A abordagem da FGPOWER:** todo programa especifica uma estratégia de progressão (geralmente progressão dupla, veja abaixo) e o app acompanha automaticamente seu desempenho registrado contra essa estratégia, para que você sempre saiba quando um aumento genuíno de demanda é indicado — sem adivinhação.`,
    sortOrder: 30,
    evidenceKeys: [
      "acsm-2009-progression-models-position-stand",
      "plotkin-2022-load-vs-rep-progression",
    ],
  },
  {
    slug: "double-progression",
    titleEn: "Double Progression",
    titlePt: "Progressão Dupla",
    summaryEn: "The default progression method in FGPOWER: increase reps within a target range first, then increase load.",
    summaryPt: "O método de progressão padrão da FGPOWER: primeiro aumente as repetições dentro de uma faixa-alvo, depois aumente a carga.",
    bodyEn: `Double progression works within a prescribed rep range — say, 8-12 — at a fixed load. You add repetitions set by set, session by session. Once every working set reaches the top of the range (12 reps) at the target RIR, load increases and reps drop back toward the bottom of the range (8), and the cycle repeats.

This gives a clear, low-ambiguity signal for when to add weight (rather than adding load on a fixed schedule regardless of actual performance), and keeps effort anchored to the same relative intensity (RIR target) across the whole cycle rather than letting a set rep target creep into near-failure territory as fatigue accumulates.

FGPOWER's progressive overload engine (see your exercise history) automatically checks your last logged session against this rule and tells you — transparently, with the reasoning shown — when a load increase is available. It never changes a weight for you automatically; you always confirm.`,
    bodyPt: `A progressão dupla trabalha dentro de uma faixa de repetições prescrita — digamos, 8 a 12 — com uma carga fixa. Você vai adicionando repetições série a série, sessão a sessão. Quando todas as séries de trabalho atingem o topo da faixa (12 reps) no RIR-alvo, a carga aumenta e as repetições voltam para o início da faixa (8), reiniciando o ciclo.

Isso dá um sinal claro e pouco ambíguo de quando aumentar o peso (em vez de aumentar a carga em um cronograma fixo, independente do desempenho real), e mantém o esforço ancorado na mesma intensidade relativa (RIR-alvo) ao longo de todo o ciclo, em vez de deixar uma meta fixa de repetições empurrar o treino para perto da falha conforme a fadiga se acumula.

O motor de sobrecarga progressiva da FGPOWER (veja no seu histórico de exercício) verifica automaticamente sua última sessão registrada contra essa regra e avisa — de forma transparente, mostrando o raciocínio — quando um aumento de carga está disponível. Ele nunca muda um peso por conta própria; você sempre confirma.`,
    sortOrder: 40,
    evidenceKeys: ["plotkin-2022-load-vs-rep-progression"],
  },
  {
    slug: "training-volume",
    titleEn: "Training Volume",
    titlePt: "Volume de Treino",
    summaryEn: "How many hard sets per muscle group per week — the variable most consistently linked to hypertrophy.",
    summaryPt: "Quantas séries de esforço por grupo muscular por semana — a variável mais consistentemente ligada à hipertrofia.",
    bodyEn: `Weekly set volume per muscle group is one of the most-studied variables in resistance training. A widely cited meta-regression of 34 groups across 15 studies found each additional weekly set associated with a small increase in hypertrophy, describing a graded — not sharply stepped — dose-response relationship, while cautioning the underlying evidence base (15 studies) is still modest.

A more recent, larger meta-regression (67 studies, 2058 participants) modeled volume more precisely by classifying sets as "direct" or only "fractional" contributors to a given muscle, and found both hypertrophy and strength increase with volume but with clearly diminishing returns at higher set counts — there is no evidence that "more is always better" without limit.

A systematic review restricted to already-trained young men found no significant difference in quadriceps or biceps growth between 12-20 vs. more than 20 weekly sets, suggesting returns flatten meaningfully somewhere in that range for many muscle groups — while a separate meta-analysis of strength (not hypertrophy) outcomes found high- and medium-volume groups reliably outperformed low-volume groups.

**FGPOWER's approach:** our smart program feedback flags a muscle group if its weekly direct set count looks unusually low or unusually high relative to this literature — always as a note to consider, never a hard rule.`,
    bodyPt: `O volume semanal de séries por grupo muscular é uma das variáveis mais estudadas no treinamento de força. Uma meta-regressão amplamente citada, com 34 grupos de 15 estudos, encontrou que cada série semanal adicional se associou a um pequeno aumento na hipertrofia, descrevendo uma relação dose-resposta gradual — não um degrau abrupto — enquanto alerta que a base de evidência (15 estudos) ainda é modesta.

Uma meta-regressão mais recente e maior (67 estudos, 2058 participantes) modelou o volume com mais precisão, classificando séries como contribuintes "diretas" ou apenas "fracionárias" para um determinado músculo, e encontrou que tanto a hipertrofia quanto a força aumentam com o volume, mas com retornos claramente decrescentes em contagens de séries mais altas — não há evidência de que "mais é sempre melhor" sem limite.

Uma revisão sistemática restrita a homens jovens já treinados não encontrou diferença significativa no crescimento de quadríceps ou bíceps entre 12-20 vs. mais de 20 séries semanais, sugerindo que os retornos se estabilizam de forma relevante nessa faixa para muitos grupos musculares — enquanto uma meta-análise separada, de desfechos de força (não hipertrofia), encontrou que grupos de volume alto e médio superaram de forma consistente os grupos de volume baixo.

**A abordagem da FGPOWER:** nosso feedback inteligente de programa sinaliza um grupo muscular quando sua contagem semanal de séries diretas parece incomumente baixa ou alta em relação a essa literatura — sempre como um ponto a considerar, nunca uma regra rígida.`,
    sortOrder: 50,
    evidenceKeys: [
      "schoenfeld-2017-volume-dose-response",
      "pelland-2025-volume-frequency-meta-regression",
      "baz-valle-2022-volume-systematic-review",
      "ralston-2017-weekly-set-volume-strength-meta-analysis",
    ],
  },
  {
    slug: "training-frequency",
    titleEn: "Training Frequency",
    titlePt: "Frequência de Treino",
    summaryEn: "How many times per week a muscle group is trained — largely a vehicle for accumulating volume without overly long, fatiguing sessions.",
    summaryPt: "Quantas vezes por semana um grupo muscular é treinado — em grande parte um meio de acumular volume sem sessões longas e exaustivas demais.",
    bodyEn: `A systematic review of 10 studies found higher weekly frequency associated with a significantly larger hypertrophy effect overall, and specifically that training a muscle group twice a week beat once a week when total volume was held equal — though there wasn't enough data to say whether 3x/week clearly beats 2x/week.

Importantly, a separate meta-analysis of 22 studies found the apparent frequency effect on *strength* disappeared once training volume was properly equated between groups — meaning frequency itself may matter less than the fact that spreading volume across more sessions typically makes more total volume achievable without any single session becoming excessively long or fatiguing.

**FGPOWER's approach:** the flagship adaptation program (see Programs) trains lower body 2x/week and distributes upper-body volume across 3 sessions per week — consistent with this literature's practical implication that more frequent, moderate sessions tend to beat fewer, longer ones for accumulating quality volume.`,
    bodyPt: `Uma revisão sistemática de 10 estudos encontrou que uma frequência semanal maior se associou a um efeito de hipertrofia geral significativamente maior, e especificamente que treinar um grupo muscular duas vezes por semana superou uma vez por semana quando o volume total era mantido igual — embora não houvesse dados suficientes para dizer se 3x/semana supera claramente 2x/semana.

É importante notar que uma meta-análise separada, de 22 estudos, encontrou que o aparente efeito da frequência sobre a *força* desaparecia quando o volume de treino era corretamente equalizado entre os grupos — o que sugere que a frequência em si pode importar menos do que o fato de que distribuir o volume em mais sessões geralmente torna mais volume total alcançável, sem que nenhuma sessão isolada fique excessivamente longa ou fatigante.

**A abordagem da FGPOWER:** o programa de adaptação principal (veja Programas) treina a parte inferior do corpo 2x/semana e distribui o volume de superior em 3 sessões por semana — consistente com a implicação prática dessa literatura de que sessões mais frequentes e moderadas tendem a superar sessões menos frequentes e mais longas para acumular volume de qualidade.`,
    sortOrder: 60,
    evidenceKeys: [
      "schoenfeld-2016-frequency-hypertrophy",
      "grgic-2018-frequency-strength",
      "pelland-2025-volume-frequency-meta-regression",
    ],
  },
  {
    slug: "rep-ranges",
    titleEn: "Rep Ranges & Load",
    titlePt: "Faixas de Repetição e Carga",
    summaryEn: "Heavy or light — for hypertrophy, load matters far less than commonly assumed, as long as effort is real.",
    summaryPt: "Pesado ou leve — para hipertrofia, a carga importa muito menos do que geralmente se assume, desde que o esforço seja real.",
    bodyEn: `A meta-analysis of 21 studies (all training to failure) found high-load training (>60% 1RM) produced greater strength gains than low-load training (≤60% 1RM), but hypertrophy gains were statistically similar across the load spectrum. A larger network meta-analysis of 28 studies replicated this pattern across a three-way load comparison (low/moderate/high), again finding similar hypertrophy but greater strength gains with moderate-to-high loads.

This means rep range is primarily a *strength-specificity* choice, not a hypertrophy on/off switch: heavier, lower-rep work builds strength most efficiently (it trains the exact skill being tested), while a wide range of loads — as long as sets are taken reasonably close to effort — can build comparable muscle size.

Both studies above restricted their designs to training performed to failure, which is why FGPOWER's default rep-range prescriptions (typically 6-15 depending on the exercise's role) pair with realistic RIR targets rather than requiring failure to be effective.`,
    bodyPt: `Uma meta-análise de 21 estudos (todos treinando até a falha) encontrou que o treino com carga alta (acima de 60% de 1RM) produziu ganhos de força maiores que o treino com carga baixa (até 60% de 1RM), mas os ganhos de hipertrofia foram estatisticamente similares ao longo do espectro de cargas. Uma meta-análise em rede maior, com 28 estudos, replicou esse padrão em uma comparação de três faixas de carga (baixa/moderada/alta), novamente encontrando hipertrofia similar mas ganhos de força maiores com cargas moderadas a altas.

Isso significa que a faixa de repetições é principalmente uma escolha de *especificidade de força*, não um interruptor liga/desliga para hipertrofia: trabalho mais pesado e com menos repetições constrói força de forma mais eficiente (treina exatamente a habilidade sendo testada), enquanto uma ampla faixa de cargas — desde que as séries sejam levadas a um esforço razoavelmente perto do limite — pode construir massa muscular comparável.

Ambos os estudos acima restringiram seus desenhos a treino levado até a falha, e é por isso que as prescrições padrão de faixa de repetições da FGPOWER (tipicamente 6 a 15, dependendo do papel do exercício) vêm acompanhadas de alvos realistas de RIR, em vez de exigir a falha para serem eficazes.`,
    sortOrder: 70,
    evidenceKeys: ["schoenfeld-2017-low-vs-high-load", "lopez-2021-load-network-meta-analysis"],
  },
  {
    slug: "rest-intervals",
    titleEn: "Rest Intervals",
    titlePt: "Intervalos de Descanso",
    summaryEn: "Longer rest supports lifting more total weight per session — the likely mechanism behind its modest hypertrophy and strength benefits.",
    summaryPt: "Descansos mais longos ajudam a levantar mais carga total por sessão — o provável mecanismo por trás de seus benefícios modestos de hipertrofia e força.",
    bodyEn: `A systematic review of 23 studies concluded that rest intervals longer than 2 minutes appear needed to maximize strength gains in trained lifters, while shorter 60-120 second rests may suffice for untrained beginners — though it notes this as a narrative synthesis, not a pooled statistical estimate. A controlled RCT directly comparing 1 vs 3 minutes of rest found the longer interval produced significantly greater strength and thigh-muscle-thickness gains over 8 weeks.

For hypertrophy specifically, a controlled trial isolating rest interval from total volume load found the two rest durations produced similar strength gains, but that **volume load — not rest interval per se — was what predicted greater muscle growth**: protocols that let lifters accumulate more total weight lifted grew more, regardless of how long they rested to get there. A 2024 Bayesian meta-analysis of 9 studies found only a small, uncertain hypertrophy benefit to resting beyond ~60-90 seconds.

**Practical takeaway:** rest long enough to maintain your target load and reps on every set — usually 2-3 minutes for compound lifts, 60-120 seconds for isolation work — rather than treating rest time as a variable to minimize for its own sake.`,
    bodyPt: `Uma revisão sistemática de 23 estudos concluiu que intervalos de descanso maiores que 2 minutos parecem necessários para maximizar os ganhos de força em praticantes treinados, enquanto descansos mais curtos, de 60 a 120 segundos, podem ser suficientes para iniciantes não treinados — embora os autores destaquem que se trata de uma síntese narrativa, não de uma estimativa estatística agrupada. Um ensaio controlado comparando diretamente 1 vs. 3 minutos de descanso encontrou que o intervalo maior produziu ganhos significativamente maiores de força e de espessura muscular da coxa ao longo de 8 semanas.

Especificamente para hipertrofia, um ensaio controlado que isolou o intervalo de descanso da carga total de volume encontrou que as duas durações de descanso produziram ganhos de força semelhantes, mas que **a carga de volume — não o intervalo de descanso em si — foi o que previu maior crescimento muscular**: protocolos que permitiam aos praticantes acumular mais peso total levantado cresceram mais, independentemente de quanto tempo descansaram para chegar lá. Uma meta-análise bayesiana de 2024, com 9 estudos, encontrou apenas um benefício pequeno e incerto de hipertrofia ao descansar além de ~60-90 segundos.

**Conclusão prática:** descanse o suficiente para manter sua carga e repetições-alvo em cada série — geralmente 2 a 3 minutos para exercícios compostos, 60 a 120 segundos para isolamento — em vez de tratar o tempo de descanso como uma variável a ser minimizada por si só.`,
    sortOrder: 80,
    evidenceKeys: [
      "grgic-2018-rest-interval-strength-review",
      "schoenfeld-2016-rest-interval-1-vs-3min",
      "longo-2022-rest-interval-volume-load",
      "singer-2024-rest-interval-bayesian-meta-analysis",
    ],
  },
  {
    slug: "range-of-motion",
    titleEn: "Range of Motion",
    titlePt: "Amplitude de Movimento",
    summaryEn: "Training through a fuller range of motion generally produces greater strength and hypertrophy than partial reps.",
    summaryPt: "Treinar em uma amplitude de movimento mais completa geralmente produz maior força e hipertrofia do que repetições parciais.",
    bodyEn: `A meta-analysis of 16 studies found full range-of-motion training produced significantly greater strength gains and greater lower-limb hypertrophy than partial range-of-motion training, with no significant difference detected in muscle architecture measures (fascicle length, pennation angle). A controlled trial isolating squat depth specifically found full-depth squats produced significantly greater adductor and gluteus maximus growth than half-depth squats, with quadriceps growth similar between conditions.

This literature generally predates more recent work specifically isolating training at *long* muscle lengths ("lengthened partials") as a distinct sub-question — so "full range of motion" here means the complete, technically sound range for that exercise, not necessarily the deepest theoretically possible position regardless of joint stress.

FGPOWER's exercise instructions specify the range of motion each movement is written and coached for; use it as the default unless a coach, physical therapist, or genuine mobility limitation says otherwise.`,
    bodyPt: `Uma meta-análise de 16 estudos encontrou que o treino em amplitude completa de movimento produziu ganhos de força significativamente maiores e maior hipertrofia dos membros inferiores do que o treino em amplitude parcial, sem diferença significativa detectada nas medidas de arquitetura muscular (comprimento do fascículo, ângulo de penação). Um ensaio controlado isolando especificamente a profundidade do agachamento encontrou que agachamentos em amplitude completa produziram crescimento significativamente maior de adutores e glúteo máximo do que agachamentos em meia amplitude, com crescimento de quadríceps semelhante entre as condições.

Essa literatura geralmente antecede trabalhos mais recentes que isolam especificamente o treino em posições de *comprimento muscular alongado* ("parciais alongados") como uma subquestão distinta — então "amplitude completa de movimento" aqui significa a amplitude completa e tecnicamente correta para aquele exercício, não necessariamente a posição teoricamente mais profunda possível, independentemente do estresse articular.

As instruções de exercício da FGPOWER especificam a amplitude de movimento para a qual cada movimento foi escrito e orientado; use-a como padrão, a menos que um treinador, fisioterapeuta ou uma limitação real de mobilidade indique o contrário.`,
    sortOrder: 90,
    evidenceKeys: ["pallares-2021-rom-meta-analysis", "kubo-2019-squat-depth-muscle-volume"],
  },
  {
    slug: "warm-up",
    titleEn: "Warming Up",
    titlePt: "Aquecimento",
    summaryEn: "A brief, exercise-specific ramp-up improves performance on the working sets that follow.",
    summaryPt: "Uma progressão breve e específica para o exercício melhora o desempenho nas séries de trabalho que seguem.",
    bodyEn: `A meta-analysis of 32 studies found warm-up activities improved subsequent physical performance in about 79% of measured outcomes, with little evidence that warming up hurts performance — though the authors note few of the included studies were well-controlled RCTs.

A resistance-training-specific scoping review found that ramping/progressive-intensity warm-up sets (working up toward your working weight) increase bar velocity at a given percentage of 1RM, and that warm-up loads in the 45-90% 1RM range increase the total repetitions completable on subsequent working sets. It also found that light loads (around 40% 1RM) lifted at maximal intended velocity optimize peak power output for bench press specifically.

**FGPOWER's approach:** the app supports marking warm-up sets distinctly from working sets in your log, and program templates that call for warm-up sets specify how many — use a light-to-moderate ramp of 1-3 sets before your first working set on compound lifts, less needed for isolation exercises.`,
    bodyPt: `Uma meta-análise de 32 estudos encontrou que atividades de aquecimento melhoraram o desempenho físico subsequente em cerca de 79% dos desfechos medidos, com pouca evidência de que aquecer prejudique o desempenho — embora os autores destaquem que poucos dos estudos incluídos eram ensaios randomizados bem controlados.

Uma revisão de escopo específica sobre treinamento de força encontrou que séries de aquecimento em rampa/intensidade progressiva (subindo em direção ao seu peso de trabalho) aumentam a velocidade da barra em uma dada porcentagem de 1RM, e que cargas de aquecimento na faixa de 45-90% de 1RM aumentam o total de repetições completáveis nas séries de trabalho seguintes. Também encontrou que cargas leves (em torno de 40% de 1RM) levantadas com velocidade intencional máxima otimizam a potência de pico especificamente no supino.

**A abordagem da FGPOWER:** o app permite marcar séries de aquecimento separadamente das séries de trabalho no seu registro, e os modelos de programa que pedem séries de aquecimento especificam quantas — use uma progressão leve a moderada de 1 a 3 séries antes da primeira série de trabalho em exercícios compostos, sendo menos necessário em exercícios de isolamento.`,
    sortOrder: 100,
    evidenceKeys: ["fradkin-2010-warm-up-physical-performance-meta-analysis", "neves-2026-resistance-training-warmup-scoping"],
  },
  {
    slug: "deloads",
    titleEn: "Deloads",
    titlePt: "Deload",
    summaryEn: "A planned period of reduced training stress to manage accumulated fatigue — practitioner consensus, with mixed direct evidence.",
    summaryPt: "Um período planejado de redução do estresse de treino para gerenciar a fadiga acumulada — consenso de profissionais, com evidência direta mista.",
    bodyEn: `A structured Delphi consensus study surveying 21-34 expert strength coaches defined deloading as "a period of reduced training stress designed to mitigate physiological and psychological fatigue, promote recovery, and enhance preparedness for subsequent training." As an expert-consensus process, it reflects practitioner experience rather than a controlled experimental outcome.

The direct experimental evidence is more mixed than the strong practitioner consensus might suggest: a 2024 RCT comparing a continuous 9-week high-volume program against the same program interrupted by a single deload week found no difference in hypertrophy, local endurance, or power gains between groups — but the group that trained continuously actually showed *greater* strength gains than the group that deloaded once, suggesting a single planned deload week can blunt strength progress without a measurable hypertrophy trade-off in already well-recovering trainees.

**FGPOWER's approach:** the flagship adaptation program builds a gradual 4-week ramp into training stress rather than starting at full intensity — a form of pre-planned load management — and we don't force a deload week onto every program by default, since the evidence for a *routine* deload's benefit (versus training through, when recovery is genuinely adequate) is not strong. If you feel persistently run down, a deload is a reasonable tool; it just isn't automatically "more optimal" on a fixed schedule.`,
    bodyPt: `Um estudo de consenso Delphi estruturado, com 21 a 34 treinadores de força especialistas, definiu o deload como "um período de estresse de treino reduzido, desenhado para mitigar a fadiga fisiológica e psicológica, promover recuperação e melhorar a prontidão para o treino seguinte". Por ser um processo de consenso de especialistas, reflete a experiência de profissionais, não um resultado experimental controlado.

A evidência experimental direta é mais mista do que o forte consenso de profissionais pode sugerir: um ensaio randomizado de 2024 comparando um programa contínuo de alto volume, de 9 semanas, contra o mesmo programa interrompido por uma única semana de deload no meio, não encontrou diferença em hipertrofia, resistência local ou ganhos de potência entre os grupos — mas o grupo que treinou continuamente na verdade mostrou ganhos de força *maiores* do que o grupo que fez deload uma vez, sugerindo que uma única semana planejada de deload pode reduzir o progresso de força sem uma troca mensurável em hipertrofia, em praticantes que já se recuperam bem.

**A abordagem da FGPOWER:** o programa de adaptação principal constrói uma progressão gradual de 4 semanas no estresse de treino em vez de começar em intensidade total — uma forma de manejo de carga pré-planejado — e não forçamos uma semana de deload em todo programa por padrão, já que a evidência de benefício de um deload *de rotina* (comparado a continuar treinando, quando a recuperação é genuinamente adequada) não é forte. Se você se sentir persistentemente desgastado, um deload é uma ferramenta razoável; ele só não é automaticamente "mais ótimo" em um cronograma fixo.`,
    sortOrder: 110,
    evidenceKeys: ["bell-2023-deloading-delphi-consensus", "coleman-2024-deload-rct-muscular-adaptations"],
  },
  {
    slug: "concurrent-training",
    titleEn: "Concurrent Training (Strength + Endurance)",
    titlePt: "Treino Concorrente (Força + Resistência)",
    summaryEn: "Combining strength and endurance training is well tolerated, with only explosive-strength gains showing a real trade-off.",
    summaryPt: "Combinar treino de força e resistência é bem tolerado, com apenas os ganhos de força explosiva mostrando uma troca real.",
    bodyEn: `A large meta-analysis of 43 studies found concurrent strength-plus-endurance training did **not** significantly compromise maximal strength or muscle hypertrophy compared to strength training alone. The one adaptation that was measurably attenuated was explosive/power strength, and that interference was worse when aerobic and strength sessions were done back-to-back in the same session rather than separated by at least 3 hours.

An earlier meta-analysis similarly found resistance training alone produced the greatest strength/power gains, with concurrent training intermediate — and found the interference effect on hypertrophy and strength was significant specifically when the endurance component was running (not cycling), and grew worse with more frequent, longer endurance sessions.

Strength training also has real, direct benefits for endurance athletes: a meta-analysis of 5 controlled trials in competitive distance runners found strength training produced a large improvement in running economy.

**Practical takeaway for FGPOWER users who run, cycle, or do other endurance work:** concurrent training is well tolerated for hypertrophy and strength; if you also care about explosive power, try separating hard endurance sessions from strength sessions by several hours where practical, and lean toward cycling/low-impact cardio over running on the same days as heavy lower-body strength work if that's an option.`,
    bodyPt: `Uma grande meta-análise de 43 estudos encontrou que o treino concorrente de força mais resistência **não** comprometeu de forma significativa a força máxima ou a hipertrofia muscular em comparação ao treino de força isolado. A única adaptação mensuravelmente reduzida foi a força/potência explosiva, e essa interferência era pior quando as sessões aeróbica e de força eram feitas em sequência, na mesma sessão, em vez de separadas por pelo menos 3 horas.

Uma meta-análise anterior encontrou de forma semelhante que o treino de força isolado produziu os maiores ganhos de força/potência, com o treino concorrente em posição intermediária — e encontrou que o efeito de interferência sobre hipertrofia e força era significativo especificamente quando o componente de resistência era corrida (não ciclismo), piorando com sessões de resistência mais frequentes e mais longas.

O treino de força também traz benefícios reais e diretos para atletas de resistência: uma meta-análise de 5 ensaios controlados em corredores de fundo competitivos encontrou que o treino de força produziu uma grande melhora na economia de corrida.

**Conclusão prática para usuários da FGPOWER que correm, pedalam ou fazem outro trabalho de resistência:** o treino concorrente é bem tolerado para hipertrofia e força; se potência explosiva também for uma prioridade, tente separar sessões duras de resistência das sessões de força por várias horas quando for prático, e prefira ciclismo/cardio de baixo impacto em vez de corrida nos mesmos dias de treino pesado de perna, se essa for uma opção.`,
    sortOrder: 120,
    evidenceKeys: [
      "schumann-2022-concurrent-training-compatibility-meta-analysis",
      "wilson-2012-concurrent-training-meta-analysis",
      "balsalobre-fernandez-2016-strength-training-running-economy",
    ],
  },
  {
    slug: "estimated-1rm",
    titleEn: "Estimated One-Rep Max (e1RM)",
    titlePt: "1RM Estimado (e1RM)",
    summaryEn: "A formula-based estimate of your one-rep max from a submaximal set — useful for tracking trends, not a substitute for an actual max test.",
    summaryPt: "Uma estimativa por fórmula do seu 1RM a partir de uma série submáxima — útil para acompanhar tendências, não um substituto para um teste real de carga máxima.",
    bodyEn: `Estimating a one-rep max (1RM) from a lighter set performed for several reps is a long-standing practical tool, popularized by field-testing formulas like Epley's and Brzycki's. FGPOWER uses the Epley formula by default (1RM ≈ weight × (1 + reps/30)), and shows the Brzycki estimate alongside it for comparison.

These formulas were built as practical coaching shortcuts, not derived from large validation trials themselves — later research (comparing several such equations against actually-measured 1RM values in trained lifters across bench press, squat, and deadlift) is what tests their real-world accuracy, and found accuracy varies by exercise and by how many reps the set went to.

**Estimates get less reliable at higher rep counts.** The math itself becomes more sensitive to small errors as reps increase, and very high-rep sets (15+) don't resemble a true maximal effort closely enough to extrapolate from confidently. FGPOWER only calculates and displays an estimated 1RM from sets of 10 reps or fewer, and always labels it clearly as "Estimated 1RM" — never as your actual 1RM. Track the trend over time rather than treating any single estimate as precise.`,
    bodyPt: `Estimar uma carga máxima de uma repetição (1RM) a partir de uma série mais leve, feita por várias repetições, é uma ferramenta prática consolidada, popularizada por fórmulas de campo como as de Epley e Brzycki. A FGPOWER usa a fórmula de Epley por padrão (1RM ≈ carga × (1 + repetições/30)), e mostra a estimativa de Brzycki ao lado, para comparação.

Essas fórmulas foram criadas como atalhos práticos de treinamento, não derivadas de grandes ensaios de validação em si — pesquisas posteriores (comparando várias dessas equações contra valores de 1RM realmente medidos em levantadores treinados, em supino, agachamento e levantamento terra) são o que testa sua precisão no mundo real, e encontraram que a precisão varia por exercício e pelo número de repetições da série.

**As estimativas ficam menos confiáveis com contagens de repetição mais altas.** A própria matemática se torna mais sensível a pequenos erros conforme as repetições aumentam, e séries de repetições muito altas (15+) não se parecem o suficiente com um esforço máximo real para extrapolar com confiança. A FGPOWER só calcula e exibe um 1RM estimado a partir de séries de até 10 repetições, e sempre o rotula claramente como "1RM Estimado" — nunca como seu 1RM real. Acompanhe a tendência ao longo do tempo, em vez de tratar qualquer estimativa isolada como precisa.`,
    sortOrder: 130,
    evidenceKeys: ["brzycki-1993-predicting-one-rep-max-reps-to-fatigue", "lesuer-1997-accuracy-1rm-prediction-equations"],
  },
  {
    slug: "beginner-adaptation",
    titleEn: "Beginner Adaptation",
    titlePt: "Adaptação do Iniciante",
    summaryEn: "Early strength gains come mostly from the nervous system learning the movement, not from a testable maximum on day one.",
    summaryPt: "Os ganhos iniciais de força vêm principalmente do sistema nervoso aprendendo o movimento, não de um máximo testável no primeiro dia.",
    bodyEn: `A widely cited narrative review concludes that neurological adaptations — better activation of the working muscles, improved coordination between muscles, spinal-level adaptations — make their greatest *relative* contribution to strength gains early in a training career, while hypertrophic (muscle growth) processes also begin immediately but increasingly dominate as training continues.

A separate study following untrained men through their first 10 weeks of training found measurable increases in muscle cross-sectional area appeared very early (within 3 weeks) — but alongside markers of muscle damage and inflammation, leading the authors to caution that some of that early size increase likely reflects swelling from muscle damage rather than genuine new tissue, while actual strength (measured directly) only increased by week 10.

**This is why FGPOWER never starts a beginner, or someone returning after a break, at full prescribed volume and intensity.** Our flagship adaptation program deliberately ramps RIR targets from ~4 (week 1) down to ~2 (week 4) and set volume up gradually over the same period, rather than testing a 1RM on day one — technique and neuromuscular coordination need time to catch up before load becomes the limiting factor worth chasing hard.`,
    bodyPt: `Uma revisão narrativa amplamente citada conclui que as adaptações neurológicas — melhor ativação dos músculos trabalhados, melhor coordenação entre músculos, adaptações em nível espinhal — dão sua maior contribuição *relativa* aos ganhos de força no início da carreira de treino, enquanto os processos hipertróficos (crescimento muscular) também começam imediatamente, mas passam a dominar cada vez mais conforme o treino continua.

Um estudo separado, acompanhando homens não treinados nas primeiras 10 semanas de treino, encontrou aumentos mensuráveis na área de secção transversal muscular muito cedo (em até 3 semanas) — mas junto com marcadores de dano muscular e inflamação, levando os autores a alertar que parte desse aumento inicial de tamanho provavelmente reflete inchaço decorrente do dano muscular, não tecido novo genuíno, enquanto a força real (medida diretamente) só aumentou na semana 10.

**É por isso que a FGPOWER nunca coloca um iniciante, ou alguém retornando de uma pausa, direto no volume e intensidade prescritos completos.** Nosso programa de adaptação principal reduz deliberadamente os alvos de RIR de ~4 (semana 1) para ~2 (semana 4), aumentando o volume de séries gradualmente no mesmo período, em vez de testar um 1RM logo no primeiro dia — a técnica e a coordenação neuromuscular precisam de tempo para se ajustar antes que a carga se torne o fator limitante que vale a pena perseguir com força.`,
    sortOrder: 140,
    evidenceKeys: ["folland-williams-2007-adaptations-strength-training", "damas-2016-early-hypertrophy-edema-swelling"],
  },
];
