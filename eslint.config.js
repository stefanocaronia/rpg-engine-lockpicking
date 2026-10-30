import stylistic from "@stylistic/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

// The engine's layout rules that dprint cannot apply: braces always, a blank line around block statements, at most one blank line.
export default [
    { ignores: ["**/dist/", "node_modules/"] },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"],
        languageOptions: { parser: typescriptParser },
        plugins: { "@stylistic": stylistic },
        rules: {
            curly: ["error", "all"],
            "@stylistic/padding-line-between-statements": [
                "error",
                { blankLine: "always", prev: "*", next: "block-like" },
                { blankLine: "always", prev: "block-like", next: "*" },
            ],
            "@stylistic/no-multiple-empty-lines": ["error", { max: 1, maxBOF: 0, maxEOF: 0 }],
        },
    },
    // A package's code reaches the game only through the engine (D-448): its dice and time, never its own, nor Node.
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        rules: {
            "no-restricted-properties": ["error", { object: "Math", property: "random", message: "Roll with the game's roll: the engine's dice." }],
            "no-restricted-globals": ["error", { name: "Date", message: "The game's time comes from the engine." }, { name: "process", message: "A package's code reaches only the game." }],
            "no-restricted-imports": ["error", { patterns: [{ group: ["node:*", "fs", "path"], message: "A package's code reaches only the game, through the engine." }] }],
            "no-restricted-syntax": [
                "error",
                { selector: "ImportExpression", message: "A package's code reaches only the game, through the engine." },
                { selector: "MemberExpression[object.name='globalThis']", message: "A package's code reaches only the game, through the engine." },
            ],
        },
    },
];
