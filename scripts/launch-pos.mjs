import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL,fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const rootIndex = args.indexOf('--pos-project');
const posRoot = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : process.env.ELEVA_POS_PROJECT || '');
if (rootIndex < 0 && !process.env.ELEVA_POS_PROJECT) throw new Error('Ange --pos-project med sökvägen till ert befintliga kassaprojekt. Se POS-INTEGRATION.md.');
const loader = path.join(posRoot,'node_modules/tsx/dist/loader.mjs');
await access(loader); await access(path.join(posRoot,'server/app.ts'));
const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../integrations/eleva-pos/runtime.mjs');
const child = spawn(process.execPath,['--import',pathToFileURL(loader).href,runtime,'--pos-project',posRoot,...(args.includes('--verify') ? ['--verify'] : [])],{ stdio:'inherit',env:{ ...process.env,APP_MODE:'training',PAYMENT_ADAPTER:'simulator',FISCAL_ADAPTER:'simulator',PRINT_ADAPTER:'preview',TEST_ENVIRONMENT:'safe-test',ADMIN_RUNTIME_TOKEN:'' } });
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,() => child.kill(signal));
child.on('exit',code => { process.exitCode = code ?? 1; });
