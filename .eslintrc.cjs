// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const prettierOptions = JSON.parse(fs.readFileSync("./.prettierrc.json", "utf8"));
/* eslint-env node */
module.exports = {
  plugins: ["@typescript-eslint", "prettier", "jest"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
  rules: {
    indent: "off",
    "prettier/prettier": [2, prettierOptions],
    "max-len": [
      "error",
      {
        code: 240,
        ignoreComments: true,
        ignoreUrls: true,
      },
    ],
    "no-trailing-spaces": "error",
    quotes: [
      "warn",
      "double",
      {
        allowTemplateLiterals: true,
      },
    ],
    semi: ["error", "always"],
    "no-var": "error",
    "no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "none",
        ignoreRestSiblings: false,
      },
    ],
    "no-mixed-spaces-and-tabs": "warn",
    curly: "off",
    "no-empty": "off",
    "no-console": "off",
    "@typescript-eslint/member-ordering": "off",
    "@typescript-eslint/interface-over-type-literal": "off",
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/typedef-whitespace": "off",
    "arrow-parens": "off",
    "@typescript-eslint/interface-name-prefix": "off",
    "@typescript-eslint/no-empty-interface": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/ban-types": "off",
  },
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  ],
};
