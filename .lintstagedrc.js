module.exports = {
  '**/*.(ts|tsx)': 'npx tsc-files --p tsconfig.esm.json --noEmit',

  // Lint then format TypeScript and JavaScript files
  '**/*.(js|jsx|ts|tsx)': filenames => [
    `npx eslint --fix --quiet ${filenames.join(' ')}`,
    `npx prettier --write ${filenames.join(' ')}`,
  ],

  // Format MarkDown and JSON
  '**/*.(md|json)': filenames => `npx prettier --write ${filenames.join(' ')}`,
}
