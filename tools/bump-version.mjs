// Sube el patch de la versión (0.0.X) y mantiene en sync src/app/version.ts y
// package.json. Lo invoca el hook pre-commit; también re-stagea los archivos.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionTsPath = join(root, 'src', 'app', 'version.ts');
const packageJsonPath = join(root, 'package.json');

const versionTs = readFileSync(versionTsPath, 'utf8');
const match = versionTs.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.(\d+)'/);
if (!match) {
  console.error('bump-version: no se encontró APP_VERSION en version.ts');
  process.exit(1);
}

const [, major, minor, patch] = match;
const next = `${major}.${minor}.${Number(patch) + 1}`;

writeFileSync(
  versionTsPath,
  versionTs.replace(/(APP_VERSION\s*=\s*')\d+\.\d+\.\d+(')/, `$1${next}$2`),
);

const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
pkg.version = next;
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

execSync(`git add "${versionTsPath}" "${packageJsonPath}"`, { cwd: root });

console.log(`bump-version: ${next}`);
