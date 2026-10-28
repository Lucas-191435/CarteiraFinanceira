#!/usr/bin/env node
// Menu dos comandos da versão Node: `node menu.mjs` na raiz.
// ↑↓ (ou j/k) escolhe, número pula direto, Enter executa, q sai. Sem dependências.
// Ctrl+C encerra o comando em execução (dev, logs -f) e volta ao menu.
//
// Comandos destrutivos (ex.: `docker compose down -v`, que apaga o banco) ficam de fora de propósito.

import { spawn } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import { createInterface } from 'node:readline/promises';

const GROUPS = [
  {
    title: 'Docker',
    items: [
      { label: 'Subir tudo', cmd: 'docker compose up -d --build' },
      { label: 'Atualizar só a API', cmd: 'docker compose up -d --build --no-deps api' },
      { label: 'Atualizar só o front', cmd: 'docker compose up -d --build --no-deps front' },
      { label: 'Popular o banco (seed)', cmd: 'docker compose --profile tools run --rm seed' },
      { label: 'Logs da API', cmd: 'docker compose logs -f --tail 100 api' },
      { label: 'Logs do front', cmd: 'docker compose logs -f --tail 100 front' },
      { label: 'Status dos containers', cmd: 'docker compose ps' },
      { label: 'Parar tudo (mantém o banco)', cmd: 'docker compose down' },
    ],
  },
  {
    title: 'Dev local',
    items: [
      { label: 'Subir só MySQL + Redis', cmd: 'npm run db:up', cwd: 'api' },
      { label: 'Parar containers da API e do front', cmd: 'docker compose stop api front' },
      { label: 'API em modo watch', cmd: 'npm run dev', cwd: 'api' },
      { label: 'Front em modo dev', cmd: 'npm run dev', cwd: 'front' },
      { label: 'Monitor do cache (Redis)', cmd: 'npm run cache:monitor', cwd: 'api' },
    ],
  },
  {
    title: 'Qualidade',
    items: [
      { label: 'Testes e2e da API', cmd: 'npm run test:e2e', cwd: 'api' },
      { label: 'Lint da API (com --fix)', cmd: 'npm run lint', cwd: 'api' },
      { label: 'Lint do front', cmd: 'npm run lint', cwd: 'front' },
      { label: 'Build do front', cmd: 'npm run build', cwd: 'front' },
    ],
  },
];

const ITEMS = GROUPS.flatMap((group) => group.items);
const ROOT = import.meta.dirname;

// Cores só num terminal de verdade (saída redirecionada recebe texto puro)
const paint = (open, close) => (s) => (process.stdout.isTTY ? `\x1b[${open}m${s}\x1b[${close}m` : s);
const c = {
  bold: paint(1, 22),
  dim: paint(2, 22),
  cyan: paint(36, 39),
  green: paint(32, 39),
  red: paint(31, 39),
};

const describe = (item) => (item.cwd ? `${item.cmd} (${item.cwd})` : item.cmd);
const width = Math.max(...ITEMS.map((item) => item.label.length)) + 2;

function render(selected) {
  const lines = [c.bold('Carteira Bolt (Node)'), ''];
  let index = 0;
  for (const group of GROUPS) {
    lines.push(` ${c.bold(group.title)}`);
    for (const item of group.items) {
      const number = String(index + 1).padStart(2);
      const text = `${number}. ${item.label.padEnd(width)}${c.dim(describe(item))}`;
      lines.push(index === selected ? c.cyan(` › ${text}`) : `   ${text}`);
      index++;
    }
  }
  lines.push('', c.dim(' ↑↓ escolhe · número pula · Enter executa · q sai'));
  // Limpa a tela e volta o cursor ao topo
  process.stdout.write(`\x1b[2J\x1b[H${lines.join('\n')}\n`);
}

/** Roda o comando com o terminal entregue a ele. Ctrl+C encerra o comando, não o menu. */
function run(item) {
  return new Promise((resolve) => {
    process.stdout.write(`\n${c.bold('$')} ${describe(item)}\n\n`);
    const ignoreSigint = () => {};
    process.on('SIGINT', ignoreSigint);
    const child = spawn(item.cmd, { cwd: item.cwd ? `${ROOT}/${item.cwd}` : ROOT, shell: true, stdio: 'inherit' });
    child.on('exit', (code) => {
      process.off('SIGINT', ignoreSigint);
      resolve(code);
    });
    child.on('error', (error) => {
      process.off('SIGINT', ignoreSigint);
      process.stdout.write(c.red(`\nNão foi possível executar: ${error.message}\n`));
      resolve(1);
    });
  });
}

async function waitEnter() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(c.dim('\nEnter para voltar ao menu '));
  rl.close();
}

/** Lê uma tecla do menu: resolve com o item escolhido ou null para sair. */
function pick(initial) {
  return new Promise((resolve) => {
    let selected = initial;
    let digits = '';
    let digitsTimer;

    const finish = (value) => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(value);
    };

    const onKey = (text, key = {}) => {
      if (key.name === 'up' || key.name === 'k') selected = (selected - 1 + ITEMS.length) % ITEMS.length;
      else if (key.name === 'down' || key.name === 'j') selected = (selected + 1) % ITEMS.length;
      else if (key.name === 'return') return finish(selected);
      else if (key.name === 'q' || key.name === 'escape' || (key.ctrl && key.name === 'c')) return finish(null);
      else if (text && /\d/.test(text)) {
        // Números de dois dígitos: junta as teclas digitadas em sequência
        clearTimeout(digitsTimer);
        digits += text;
        digitsTimer = setTimeout(() => (digits = ''), 700);
        const target = Number(digits) - 1;
        if (target >= 0 && target < ITEMS.length) selected = target;
      }
      render(selected);
    };

    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', onKey);
    render(selected);
  });
}

/** Sem terminal interativo (ex.: saída redirecionada): lista numerada e pergunta o número. */
async function pickByNumber() {
  ITEMS.forEach((item, index) => console.log(`${String(index + 1).padStart(2)}. ${item.label}  ${describe(item)}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nNúmero do comando (Enter sai): ');
  rl.close();
  const index = Number(answer) - 1;
  return index >= 0 && index < ITEMS.length ? index : null;
}

async function main() {
  if (!process.stdin.isTTY) {
    const index = await pickByNumber();
    if (index !== null) process.exitCode = await run(ITEMS[index]);
    return;
  }

  let selected = 0;
  for (;;) {
    const index = await pick(selected);
    if (index === null) break;
    selected = index;

    const code = await run(ITEMS[index]);
    process.stdout.write(code === 0 ? c.green('\n✓ Concluído\n') : c.red(`\n✗ Saiu com código ${code}\n`));
    await waitEnter();
  }
  process.stdout.write('\n');
}

void main();
