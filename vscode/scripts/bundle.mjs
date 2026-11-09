// Copia o Studio (páginas, src/, tools/, exemplos) para media/ antes de empacotar a extensão (.vsix).
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), repo = join(here, '..', '..'), media = join(here, '..', 'media');
rmSync(media, { recursive: true, force: true }); mkdirSync(media, { recursive: true });
for (const p of ['editor.html', 'boot.html', 'pcb.html', 'watch.html', 'src', 'tools/studio-server.mjs', 'tools/lib', 'data', 'examples/pcb', 'examples/firmware/relogio/relogio-nano.hex', 'examples/firmware/relogio-cor/relogio-cor-nano.hex', 'avc.html', 'examples/firmware/pulseira-avc/pulseira-avc-nano.hex', 'LICENSE'])
  cpSync(join(repo, p), join(media, p), { recursive: true });
console.log('Studio copiado para', media);
