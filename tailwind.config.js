// Enterprise design tokens. All colors are RGB triples defined as CSS
// variables in src/index.css so light/dark swap with a single class on <html>.
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("--canvas"),
        surface: token("--surface"),
        "surface-2": token("--surface-2"),
        line: token("--line"),
        "line-2": token("--line-2"),
        ink: token("--ink"),
        "ink-2": token("--ink-2"),
        "ink-3": token("--ink-3"),
        accent: token("--accent"),
        pos: token("--pos"),
        neg: token("--neg"),
        warn: token("--warn"),
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
      boxShadow: {
        elev: "0 1px 2px rgb(13 18 28 / 0.05)",
        pop: "0 12px 32px rgb(4 8 16 / 0.16), 0 2px 8px rgb(4 8 16 / 0.08)",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.2, 0, 0.13, 1)",
      },
    },
  },
  plugins: [],
};
