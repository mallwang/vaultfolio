// Custom Nx Release version actions: identical to the built-in JS ones, plus
// api/openapi.yml's `info.version` is bumped in the same pass. Nx stages the
// files returned from afterAllProjectsVersioned into the release commit, so
// the spec no longer needs a second "regenerate" commit after every release.
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const jsVersionActions = require('@nx/js/src/release/version-actions');

const OPENAPI_PATH = 'api/openapi.yml';

// Line-based on purpose: a single regex spanning the whole `info:` block needs
// nested quantifiers, which Sonar flags as backtracking-prone (S5852).
function setInfoVersion(spec, version) {
  const lines = spec.split('\n');
  const start = lines.indexOf('info:');
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('  version: ')) {
      lines[i] = `  version: ${version}`;
      return lines.join('\n');
    }
    // A non-empty line without indentation ends the `info:` block.
    if (line !== '' && !line.startsWith(' ')) return null;
  }
  return null;
}

async function afterAllProjectsVersioned(cwd, opts) {
  const result = await jsVersionActions.afterAllProjectsVersioned(cwd, opts);
  if (opts.dryRun) return result;

  const { version } = JSON.parse(readFileSync(join(cwd, 'apps/backend/package.json'), 'utf-8'));
  const specPath = join(cwd, OPENAPI_PATH);
  const spec = readFileSync(specPath, 'utf-8');
  const updated = setInfoVersion(spec, version);
  if (updated === null) {
    throw new Error(`Could not find info.version in ${OPENAPI_PATH} to bump it to ${version}.`);
  }
  if (updated === spec) return result;

  writeFileSync(specPath, updated);
  return { ...result, changedFiles: [...result.changedFiles, OPENAPI_PATH] };
}

module.exports = jsVersionActions.default;
module.exports.default = jsVersionActions.default;
module.exports.afterAllProjectsVersioned = afterAllProjectsVersioned;
