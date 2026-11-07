// The prop registry. Each module is loaded on its own, so a module with a mistake in it can't stop the others from rendering:
// its error shows up in `propErrors`, and render.mjs prints it.
const MODULES = ['basic', 'free-weights', 'benches', 'cables', 'machines', 'cardio', 'strongman', 'small-gear']

export const PROPS = {}
export const propErrors = []

await Promise.all(
  MODULES.map(async (name) => {
    try {
      const m = await import(`./${name}.js`)
      Object.assign(PROPS, m.default)
    } catch (e) {
      // A module that doesn't exist yet is not an error.
      const text = String(e && e.stack ? e.stack : e)
      if (!/Failed to fetch dynamically imported module/.test(text)) propErrors.push(`${name}: ${text}`)
      else propErrors.push(`${name}: not loaded (missing, or a syntax error in it)`)
    }
  }),
)
