"use strict";

const SOURCE_FILES = [
  "*.js",
  "2048/*.js",
  "block-sweep/*.js",
  "breakout/*.js",
  "bubble-pop/*.js",
  "cafe-queue/*.js",
  "clicker/*.js",
  "connect-four/*.js",
  "cows/*.js",
  "cross-walk/*.js",
  "cup-flow/*.js",
  "dudes/*.js",
  "fishing/*.js",
  "garden-snap/*.js",
  "guac-a-mole/*.js",
  "hangman/*.js",
  "math/*.js",
  "memory-match/*.js",
  "mine/*.js",
  "paper-io/*.js",
  "pixel-drop/*.js",
  "quiz/*.js",
  "ramp-rush/*.js",
  "runosaur/*.js",
  "snake/*.js",
  "space-shooter/*.js",
  "space-waves/*.js",
  "stacker/*.js",
  "sticker-garage/*.js",
  "sudoku/*.js",
  "tic-tac-toe/*.js",
  "wing-hop/*.js",
  "desktop/*.js",
  "discord-bot/*.js"
];

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "desktop/dist/**",
      "dictionary*.js",
      "ramp-rush/rr-bg-*.js",
      "tools/**",
      "words*.js"
    ]
  },
  {
    files: SOURCE_FILES,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script"
    },
    rules: {
      "constructor-super": "error",
      "getter-return": "error",
      "no-async-promise-executor": "error",
      "no-class-assign": "error",
      "no-const-assign": "error",
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-dupe-else-if": "error",
      "no-dupe-keys": "error",
      "no-func-assign": "error",
      "no-import-assign": "error",
      "no-new-native-nonconstructor": "error",
      "no-obj-calls": "error",
      "no-self-assign": "error",
      "no-setter-return": "error",
      "no-unreachable": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-negation": "error",
      "no-useless-backreference": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "error"
    }
  }
];
