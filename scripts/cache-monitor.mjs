// Mostra o tráfego do cache (Redis MONITOR) de forma legível: HIT/MISS, chave traduzida e valor resumido.
//
//   npm run cache:monitor              # visão resumida
//   npm run cache:monitor -- --values  # inclui o JSON gravado em cada MISS
//   npm run cache:monitor -- --all     # não esconde ping/info/etc.
//
// HIT/MISS é inferido: o CacheService.remember() faz GET e, se não achou, SET na mesma chave logo em
// seguida. Por isso os comandos são agrupados em rajadas (uma requisição costuma ser uma rajada) e só
// impressos quando o Redis fica quieto por IDLE_MS.
import Redis from 'ioredis';

try {
  process.loadEnvFile('.env');
} catch {
  // sem .env: usa o default abaixo
}

const args = new Set(process.argv.slice(2));
const SHOW_VALUES = args.has('--values');
const SHOW_ALL = args.has('--all');
const IDLE_MS = 300;
const NOISE = new Set(['ping', 'info', 'client', 'select', 'hello', 'command', 'monitor', 'quit']);

const url = process.env.REDIS_URL || 'redis://localhost:4379';
const prefix = process.env.REDIS_KEY_PREFIX ?? '';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const c = {
  dim: paint('2'),
  bold: paint('1'),
  green: paint('32'),
  yellow: paint('33'),
  red: paint('31'),
  cyan: paint('36'),
  magenta: paint('35'),
};

// Nomes aprendidos dos próprios valores gravados, para trocar UUID por gente
const userNames = new Map();
const walletOwner = new Map();

const short = (id) => id.slice(0, 8);
const who = (userId) => userNames.get(userId) ?? `user ${short(userId)}`;
const walletLabel = (walletId) => {
  const owner = walletOwner.get(walletId);
  return owner ? `carteira de ${who(owner)}` : `carteira ${short(walletId)}`;
};

function describeKey(rawKey) {
  const key = prefix && rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : rawKey;
  let m;
  if ((m = key.match(/^user:([^:]+):auth$/))) return { kind: 'auth', label: `auth · ${who(m[1])}`, id: m[1] };
  if ((m = key.match(/^user:([^:]+):me$/))) return { kind: 'me', label: `perfil · ${who(m[1])}`, id: m[1] };
  if ((m = key.match(/^user:([^:]+):walletId$/))) return { kind: 'walletId', label: `id da carteira · ${who(m[1])}`, id: m[1] };
  if ((m = key.match(/^search:([^:]+):(.*)$/))) return { kind: 'search', label: `busca "${m[2]}" · ${who(m[1])}` };
  if ((m = key.match(/^wallet:([^:]+):v$/))) return { kind: 'version', label: `versão · ${walletLabel(m[1])}`, id: m[1] };
  if ((m = key.match(/^wallet:([^:]+):v(\d+):balance$/)))
    return { kind: 'balance', label: `saldo · ${walletLabel(m[1])} ${c.dim(`v${m[2]}`)}` };
  if ((m = key.match(/^wallet:([^:]+):v(\d+):stmt:(\d+):(\d+):(.*)$/))) {
    // o período (from:to) é ISO com ":" dentro, então fica inteiro no último grupo
    const [, walletId, version, page, size, period] = m;
    const range = period === '-:-' ? '' : ` · período ${period}`;
    return { kind: 'stmt', label: `extrato p${page} (${size}/pág)${range} · ${walletLabel(walletId)} ${c.dim(`v${version}`)}` };
  }
  return { kind: 'other', label: key };
}

const brl = (value) => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function summarize(kind, raw, keyInfo) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return `${raw.length} B`;
  }
  switch (kind) {
    case 'me':
      if (data?.name) userNames.set(data.id, data.name);
      return data ? `${data.name} <${data.email}>` : 'null';
    case 'walletId':
      if (typeof data === 'string') walletOwner.set(data, keyInfo.id);
      return data ? `carteira ${short(data)}` : 'sem carteira';
    case 'balance':
      return data ? brl(data.balance) : 'null';
    case 'stmt':
      return data ? `${data.rows.length} de ${data.count} lançamentos` : 'null';
    case 'search':
      return Array.isArray(data) ? `${data.length} resultado(s)` : '';
    case 'auth':
      return data ? 'usuário válido' : 'usuário não encontrado';
    default:
      return '';
  }
}

const sizeOf = (raw) => {
  const bytes = Buffer.byteLength(raw);
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};
const ttlOf = (setArgs) => {
  const i = setArgs.findIndex((a) => a.toLowerCase() === 'ex');
  if (i === -1) return 'sem TTL';
  const secs = Number(setArgs[i + 1]);
  return secs % 60 === 0 ? `TTL ${secs / 60}min` : `TTL ${secs}s`;
};

const clock = (unix) => {
  const d = new Date(Number(unix) * 1000);
  return d.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
};

let burst = [];
let flushTimer = null;
let stats = { hit: 0, miss: 0 };

function flush() {
  flushTimer = null;
  const events = burst;
  burst = [];
  if (events.length === 0) return;

  const start = Number(events[0].time);
  const end = Number(events[events.length - 1].time);
  const lines = [];
  const consumed = new Set();
  let hits = 0;
  let misses = 0;

  events.forEach((ev, i) => {
    if (consumed.has(i)) return;
    const [cmd, key, ...rest] = ev.args;
    const at = c.dim(`+${((Number(ev.time) - start) * 1000).toFixed(0).padStart(3)}ms`);

    if (cmd === 'get' && key) {
      const info = describeKey(key);
      if (info.kind === 'version') {
        // O valor não aparece no MONITOR; a versão usada aparece na próxima chave dessa carteira
        const next = events.slice(i + 1).find((e) => e.args[1]?.includes(`wallet:${info.id}:v`) && !e.args[1].endsWith(':v'));
        const v = next?.args[1].match(/:v(\d+):/)?.[1];
        lines.push(`${at}  ${c.dim('·    ')} ${c.dim(info.label + (v ? ` → v${v}` : ''))}`);
        return;
      }
      const setIndex = events.findIndex((e, j) => j > i && e.args[0] === 'set' && e.args[1] === key);
      if (setIndex === -1) {
        hits++;
        lines.push(`${at}  ${c.green('HIT ')}  ${info.label}`);
        return;
      }
      consumed.add(setIndex);
      misses++;
      const set = events[setIndex];
      const raw = set.args[2] ?? '';
      const took = ((Number(set.time) - Number(ev.time)) * 1000).toFixed(0);
      const summary = summarize(info.kind, raw, info);
      // Releitura do label: o summarize pode ter acabado de aprender um nome
      const label = describeKey(key).label;
      lines.push(
        `${at}  ${c.yellow('MISS')}  ${label}  ${c.dim('→ banco')} ${c.dim(`${took}ms`)}  ${c.cyan(summary)}  ${c.dim(`${sizeOf(raw)} · ${ttlOf(set.args.slice(3))}`)}`,
      );
      if (SHOW_VALUES) lines.push(prettyValue(raw));
      return;
    }

    if (cmd === 'incr' && key?.endsWith(':v')) {
      const info = describeKey(key);
      lines.push(`${at}  ${c.magenta('INVAL')} ${info.label.replace('versão · ', '')} ${c.dim('— versão++, saldo/extrato antigos deixam de valer')}`);
      return;
    }

    if (cmd === 'set' && key) {
      const info = describeKey(key);
      lines.push(`${at}  ${c.cyan('SET ')}  ${info.label}  ${c.cyan(summarize(info.kind, ev.args[2] ?? '', info))}`);
      return;
    }

    const shown = ev.args.map((a) => (a.length > 80 ? `${a.slice(0, 77)}...` : a)).join(' ');
    lines.push(`${at}  ${c.dim(cmd.toUpperCase().padEnd(5))} ${shown.slice(cmd.length + 1)}`);
  });

  stats.hit += hits;
  stats.miss += misses;
  const total = stats.hit + stats.miss;
  const ratio = total ? Math.round((stats.hit / total) * 100) : 0;
  const header = [
    c.bold(clock(start)),
    c.dim(`${events.length} cmd em ${((end - start) * 1000).toFixed(0)}ms`),
    hits || misses ? `${c.green(`${hits} hit`)} ${c.yellow(`${misses} miss`)}` : '',
    c.dim(`(sessão: ${ratio}% hit)`),
  ]
    .filter(Boolean)
    .join('  ');

  console.log(`\n${c.dim('──')} ${header} ${c.dim('──')}`);
  for (const line of lines) console.log(line);
}

function prettyValue(raw) {
  let text;
  try {
    text = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    text = raw;
  }
  const lines = text.split('\n');
  const MAX = 40;
  const cut = lines.length > MAX ? [...lines.slice(0, MAX), `... (+${lines.length - MAX} linhas)`] : lines;
  return cut.map((l) => c.dim(`         │ ${l}`)).join('\n');
}

const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
try {
  await redis.connect();
} catch (error) {
  console.error(`Não conectou em ${url}: ${error.message}`);
  process.exit(1);
}
const monitor = await redis.monitor();
console.log(c.dim(`Monitorando ${url}${prefix ? ` (prefixo "${prefix}")` : ''} — Ctrl+C para sair`));

monitor.on('monitor', (time, cmdArgs) => {
  const cmd = String(cmdArgs[0] ?? '').toLowerCase();
  if (!SHOW_ALL && NOISE.has(cmd)) return;
  burst.push({ time, args: [cmd, ...cmdArgs.slice(1).map(String)] });
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, IDLE_MS);
});

process.on('SIGINT', () => {
  flush();
  const total = stats.hit + stats.miss;
  console.log(c.dim(`\n${stats.hit} hit / ${stats.miss} miss${total ? ` (${Math.round((stats.hit / total) * 100)}% hit)` : ''}`));
  monitor.disconnect();
  redis.disconnect();
  process.exit(0);
});
