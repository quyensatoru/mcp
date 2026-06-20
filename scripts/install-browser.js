import { execSync } from 'node:child_process';

try {
    execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
} catch {
    console.warn(
        '⚠️  Playwright chromium install failed. Run manually: npx playwright install chromium',
    );
}
