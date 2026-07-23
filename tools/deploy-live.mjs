// Push main to the personal Vercel mirror (NZEN-7/marketing-website-live).
//
// Same pattern as TD-Platform: Vercel Hobby only deploys commits whose
// committer maps to the project owner's GitHub account, and org commits
// are authored as nick@thermaldawn.com — so this re-stamps HEAD with the
// NZEN-7 noreply identity on a throwaway branch and force-pushes that.
// Org history is never touched.
//
// Usage: npm run deploy:live
import { execSync } from 'node:child_process';

const MIRROR = 'https://github.com/NZEN-7/marketing-website-live.git';
const sh = (cmd) => execSync(cmd, { stdio: 'pipe' }).toString().trim();

if (sh('git status --porcelain') !== '') {
  console.error('working tree not clean — commit first');
  process.exit(1);
}
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  console.error(`on ${branch} — deploy from main`);
  process.exit(1);
}

// Ensure the mirror remote exists (idempotent).
try {
  sh('git remote get-url deploy');
} catch {
  sh(`git remote add deploy ${MIRROR}`);
}

sh('git branch -f deploy-tmp main');
sh('git checkout -q deploy-tmp');
try {
  sh('git -c user.name="NZEN-7" -c user.email="NZEN-7@users.noreply.github.com" commit --amend --no-edit --reset-author -q');
  console.log(execSync('git push deploy deploy-tmp:main --force 2>&1').toString().trim());
} finally {
  sh('git checkout -q main');
  sh('git branch -q -D deploy-tmp');
}
console.log('deployed: main → NZEN-7/marketing-website-live (Vercel builds automatically)');
