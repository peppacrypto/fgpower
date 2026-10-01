import type { SharedWorkout } from "@/lib/data/share";
import { isWorkoutMilestone } from "@/lib/programming/milestones";
import { exerciseLine, formatShareDate, storyStats, stripEmoji, truncate } from "@/lib/social/public-workout";
import { plural } from "@/lib/utils/format";
import { corners, mono, OgWordmark, PrTag } from "./parts";
import { OG, OG_DOMAIN } from "./theme";

/**
 * A shared workout's two images: the link preview (1200×630, /t/<token>'s
 * og:image) and the story (1080×1920, "Compartilhar imagem"). Both show only
 * what the /t page shows — the loads only when the owner shows them — and no
 * emoji (Satori would fetch their glyphs at render time).
 */

export interface WorkoutImageData {
  workoutName: string;
  date: string;
  ordinal: number;
  milestone: boolean;
  stats: { label: string; value: string }[];
  records: { name: string; text: string }[];
  exercises: { name: string; line: string }[];
  author: { name: string; username: string | null };
  caption: string | null;
}

export function workoutImageData(shared: SharedWorkout): WorkoutImageData {
  const clean = (text: string, max: number) => truncate(stripEmoji(text), max);
  return {
    workoutName: clean(shared.view.workoutName, 60) || "Treino",
    date: formatShareDate(shared.finishedAt),
    ordinal: shared.ordinal,
    milestone: isWorkoutMilestone(shared.ordinal),
    stats: storyStats(shared.view, shared.durationSeconds),
    records: shared.view.records.map((r) => ({ name: clean(r.exerciseName, 48), text: r.text })),
    exercises: shared.view.exercises.map((e) => ({ name: clean(e.name, 60), line: exerciseLine(e) })),
    author: { name: clean(shared.author.name, 40) || "Atleta", username: shared.author.username },
    caption: shared.activity.caption ? clean(shared.activity.caption, 120) || null : null,
  };
}

const byline = (a: WorkoutImageData["author"]) => (a.username ? `${a.name} (@${a.username})` : a.name);

/** The /t/<token> link preview, 1200×630. */
export function WorkoutOgCard({ data, tile }: { data: WorkoutImageData; tile: string }) {
  const long = data.workoutName.length > 34;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG.BG,
        position: "relative",
        padding: 64,
        fontFamily: "Inter",
        color: OG.FG,
      }}
    >
      {corners({ inset: 24, length: 40, width: 3 })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgWordmark size={30} tile={tile} />
        <div style={mono(18)}>{`Treino concluído · ${data.date}`}</div>
      </div>
      <div style={{ fontSize: long ? 56 : 72, fontWeight: 800, lineHeight: 1.06, marginTop: 40, letterSpacing: -1.5 }}>
        {data.workoutName}
      </div>
      <div style={{ display: "flex", marginTop: 32, gap: 56 }}>
        {data.stats.map((s) => (
          <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
            <div style={mono(16)}>{s.label}</div>
            <div style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 44, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: `3px solid ${OG.FG}`, paddingTop: 20 }}>
        {data.records.length > 0 ? <PrTag size={18} text={data.records.length === 1 ? "1 PR" : `${data.records.length} PRs`} /> : null}
        <div style={{ fontSize: 26, fontWeight: 600 }}>{byline(data.author)}</div>
      </div>
    </div>
  );
}

/*
 * The story keeps its content inside Instagram's safe area (y 250–1670): a
 * 1420 px column. What doesn't fit is left out whole (exercises first,
 * then records), never cut through; "+N exercícios" says what's missing.
 */
const SAFE_HEIGHT = 1420;
const PAD_X = 96;
const CONTENT_WIDTH = 1080 - 2 * PAD_X;

function nameStyle(name: string) {
  const size = name.length <= 26 ? 96 : name.length <= 44 ? 80 : 66;
  // ~0.56 em per character at 800 weight.
  const perLine = Math.max(1, Math.floor(CONTENT_WIDTH / (size * 0.56)));
  const lines = Math.min(4, Math.ceil(name.length / perLine));
  return { size, height: lines * size * 1.08 };
}

export function storyLayout(data: WorkoutImageData) {
  const name = nameStyle(data.workoutName);
  const fixed =
    70 + // wordmark row
    72 + 12 + 20 + 34 + // accent square and kicker
    20 + name.height +
    48 + 164 + // stat strip
    (data.milestone ? 88 : 0) +
    (data.caption ? 40 + Math.ceil(data.caption.length / 50) * 44 : 0) +
    112; // footer
  let room = SAFE_HEIGHT - fixed;
  const RECORD_ROW = 136;
  const EXERCISE_ROW = 54;
  const SECTION_HEAD = 48 + 30;
  let records = 0;
  if (data.records.length > 0 && room >= SECTION_HEAD + RECORD_ROW) {
    records = Math.min(3, data.records.length, Math.floor((room - SECTION_HEAD) / RECORD_ROW));
    // Leave room for at least two exercises when there are any.
    while (records > 1 && room - SECTION_HEAD - records * RECORD_ROW < SECTION_HEAD + 2 * EXERCISE_ROW) records--;
    room -= SECTION_HEAD + records * RECORD_ROW;
  }
  let exercises = 0;
  if (room >= SECTION_HEAD + EXERCISE_ROW) {
    const rows = Math.floor((room - SECTION_HEAD) / EXERCISE_ROW);
    exercises = data.exercises.length <= rows ? data.exercises.length : Math.max(0, Math.min(6, rows - 1));
    exercises = Math.min(6, exercises);
  }
  return { name, records, exercises, more: data.exercises.length - exercises };
}

/** The story image, 1080×1920. */
export function StoryImage({ data, tile }: { data: WorkoutImageData; tile: string }) {
  const layout = storyLayout(data);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: OG.BG,
        position: "relative",
        padding: `250px ${PAD_X}px`,
        fontFamily: "Inter",
        color: OG.FG,
      }}
    >
      {corners({ inset: 56, length: 72, width: 4 })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <OgWordmark size={44} tile={tile} />
        <div style={mono(24)}>{`Nº ${data.ordinal}`}</div>
      </div>
      <div style={{ display: "flex", marginTop: 72, width: 12, height: 12, background: OG.ACCENT }} />
      <div style={{ ...mono(28, OG.ACCENT), marginTop: 20 }}>{`Treino concluído · ${data.date}`}</div>
      <div
        style={{
          fontSize: layout.name.size,
          fontWeight: 800,
          lineHeight: 1.08,
          marginTop: 20,
          letterSpacing: -2,
          maxHeight: layout.name.height + 8,
          overflow: "hidden",
        }}
      >
        {data.workoutName}
      </div>
      <div style={{ display: "flex", marginTop: 48, borderTop: `3px solid ${OG.FG}`, borderBottom: `1px solid ${OG.RULE}` }}>
        {data.stats.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "24px 0",
              paddingLeft: i ? 28 : 0,
              borderLeft: i ? `1px solid ${OG.RULE}` : "none",
            }}
          >
            <div style={mono(22)}>{s.label}</div>
            <div style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 56, marginTop: 8 }}>{s.value}</div>
          </div>
        ))}
      </div>
      {data.milestone ? (
        <div style={{ display: "flex", marginTop: 40 }}>
          <div style={{ ...mono(30, OG.ACCENT), border: `4px solid ${OG.ACCENT}`, padding: "8px 18px", transform: "rotate(-2deg)" }}>
            {`Dossiê nº ${data.ordinal}`}
          </div>
        </div>
      ) : null}
      {layout.records > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...mono(24), marginTop: 48 }}>
            {data.records.length > layout.records ? `Recordes · ${data.records.length}` : "Recordes"}
          </div>
          {data.records.slice(0, layout.records).map((r) => (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 16,
                padding: "20px 24px",
                background: OG.ACCENT_SOFT,
                borderLeft: `8px solid ${OG.ACCENT}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 34, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {r.name}
                </div>
                <div style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 26, color: OG.MUTED, marginTop: 4 }}>{r.text}</div>
              </div>
              <div style={{ display: "flex", marginLeft: 20 }}>
                <PrTag size={24} text="PR" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {layout.exercises > 0 ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ ...mono(24), marginTop: 48 }}>{`Exercícios · ${data.exercises.length}`}</div>
          {data.exercises.slice(0, layout.exercises).map((e, i) => (
            <div key={`${i}-${e.name}`} style={{ display: "flex", alignItems: "baseline", marginTop: 14, gap: 20 }}>
              <div style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 24, color: OG.REG, width: 40 }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  minWidth: 0,
                  fontSize: 32,
                  fontWeight: 600,
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {e.name}
              </div>
              <div style={{ fontFamily: "Mono", fontWeight: 700, fontSize: 24, color: OG.MUTED }}>{e.line}</div>
            </div>
          ))}
          {layout.more > 0 ? (
            <div style={{ ...mono(22), marginTop: 14 }}>{`+${plural(layout.more, "exercício", "exercícios")}`}</div>
          ) : null}
        </div>
      ) : null}
      {data.caption ? (
        <div style={{ display: "flex", marginTop: 40, fontSize: 34, lineHeight: 1.3, color: OG.FG }}>{`“${data.caption}”`}</div>
      ) : null}
      <div style={{ display: "flex", flex: 1 }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: `1px solid ${OG.RULE}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>Treine com um motivo.</div>
          <div style={{ ...mono(22), marginTop: 8 }}>
            {data.author.username ? `@${data.author.username} · ${OG_DOMAIN}` : OG_DOMAIN}
          </div>
        </div>
      </div>
    </div>
  );
}
