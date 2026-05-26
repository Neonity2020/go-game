import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const port = Number(process.env.KATAGO_BRIDGE_PORT || 3107);

const katagoBin = process.env.KATAGO_BIN || '/opt/homebrew/bin/katago';
const katagoShare = process.env.KATAGO_SHARE || '/opt/homebrew/opt/katago/share/katago';
const modelCandidates = [
  process.env.KATAGO_MODEL,
  path.join(katagoShare, 'kata1-b18c384nbt-s9996604416-d4316597426.bin.gz'),
  path.join(katagoShare, 'g170e-b20c256x2-s5303129600-d1228401921.bin.gz'),
  path.join(katagoShare, 'g170-b40c256x2-s5095420928-d1229425124.bin.gz'),
].filter(Boolean);
const configCandidates = [
  process.env.KATAGO_CONFIG,
  path.join(katagoShare, 'configs/gtp_example.cfg'),
].filter(Boolean);

const katagoModel = modelCandidates.find(candidate => existsSync(candidate));
const katagoConfig = configCandidates.find(candidate => existsSync(candidate));
const logDir = path.join(projectRoot, 'server/katago_logs');
const overrideConfig = process.env.KATAGO_OVERRIDE_CONFIG ||
  `maxVisits=96,numSearchThreads=4,ponderingEnabled=false,allowResignation=false,logDir=${logDir},logAllGTPCommunication=false,logSearchInfo=false,logToStderr=false`;

const columns = 'ABCDEFGHJKLMNOPQRST';
let katagoProcess = null;
let stdoutBuffer = '';
const pendingResponses = [];

function ensureLogDir() {
  mkdirSync(logDir, { recursive: true });
}

function toGtpColor(player) {
  return player === 'black' ? 'B' : 'W';
}

function toGtpCoord(position, boardSize) {
  if (!position) return 'pass';
  return `${columns[position.col]}${boardSize - position.row}`;
}

function fromGtpCoord(coord, boardSize) {
  const normalized = coord.trim().toLowerCase();
  if (normalized === 'pass') return null;
  if (normalized === 'resign') return 'resign';

  const letter = coord[0].toUpperCase();
  const col = columns.indexOf(letter);
  const rowNumber = Number(coord.slice(1));
  const row = boardSize - rowNumber;

  if (col < 0 || col >= boardSize || !Number.isInteger(row) || row < 0 || row >= boardSize) {
    throw new Error(`Invalid KataGo coordinate: ${coord}`);
  }

  return { row, col };
}

function parseResponses() {
  let boundary = stdoutBuffer.indexOf('\n\n');
  while (boundary !== -1) {
    const raw = stdoutBuffer.slice(0, boundary).trim();
    stdoutBuffer = stdoutBuffer.slice(boundary + 2);
    const pending = pendingResponses.shift();
    if (pending) {
      pending.finish(raw);
    }
    boundary = stdoutBuffer.indexOf('\n\n');
  }
}

function startKataGo() {
  if (katagoProcess) return;
  if (!existsSync(katagoBin)) throw new Error(`KataGo binary not found: ${katagoBin}`);
  if (!katagoModel) throw new Error('KataGo model not found. Set KATAGO_MODEL to a .bin.gz model path.');
  if (!katagoConfig) throw new Error('KataGo config not found. Set KATAGO_CONFIG to a gtp config path.');

  ensureLogDir();
  katagoProcess = spawn(katagoBin, [
    'gtp',
    '-config',
    katagoConfig,
    '-model',
    katagoModel,
    '-override-config',
    overrideConfig,
  ], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  katagoProcess.stdout.setEncoding('utf8');
  katagoProcess.stdout.on('data', chunk => {
    stdoutBuffer += chunk;
    parseResponses();
  });

  katagoProcess.stderr.setEncoding('utf8');
  katagoProcess.stderr.on('data', chunk => {
    const text = chunk.trim();
    if (text) console.error(`[katago] ${text}`);
  });

  katagoProcess.on('exit', (code, signal) => {
    katagoProcess = null;
    stdoutBuffer = '';
    const error = new Error(`KataGo exited (${code ?? signal})`);
    while (pendingResponses.length > 0) {
      pendingResponses.shift()?.reject(error);
    }
  });
}

function sendGtp(command, timeoutMs = 60_000) {
  startKataGo();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for KataGo: ${command}`));
    }, timeoutMs);

    pendingResponses.push({
      finish(raw) {
        clearTimeout(timer);
        if (raw.startsWith('?')) {
          reject(new Error(raw));
          return;
        }
        resolve(raw.replace(/^=\s*/, '').trim());
      },
      reject(error) {
        clearTimeout(timer);
        reject(error);
      },
    });

    katagoProcess.stdin.write(`${command}\n`);
  });
}

async function getMove(state, komi) {
  const boardSize = state?.boardSize;
  const currentPlayer = state?.currentPlayer;
  const moves = state?.moveRecords;
  if (![9, 13, 19].includes(boardSize)) throw new Error('Unsupported board size');
  if (currentPlayer !== 'black' && currentPlayer !== 'white') throw new Error('Invalid current player');
  if (!Array.isArray(moves)) throw new Error('Invalid move records');

  await sendGtp(`boardsize ${boardSize}`);
  await sendGtp('clear_board');
  await sendGtp(`komi ${Number.isFinite(komi) ? komi : 6.5}`);

  for (const move of moves) {
    await sendGtp(`play ${toGtpColor(move.player)} ${toGtpCoord(move.position, boardSize)}`);
  }

  const rawMove = await sendGtp(`genmove ${toGtpColor(currentPlayer)}`, 120_000);
  return fromGtpCoord(rawMove.split(/\s+/)[0], boardSize);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: Boolean(existsSync(katagoBin) && katagoModel && katagoConfig),
        running: Boolean(katagoProcess),
        katagoBin,
        katagoModel,
        katagoConfig,
        port,
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/move') {
      const body = await readBody(request);
      const payload = JSON.parse(body);
      const result = await getMove(payload.state, Number(payload.komi));
      sendJson(response, 200, { engine: 'katago', result });
      return;
    }

    sendJson(response, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`KataGo bridge listening on http://127.0.0.1:${port}`);
  console.log(`KataGo model: ${katagoModel || '(not found)'}`);
  console.log(`KataGo config: ${katagoConfig || '(not found)'}`);
});

process.on('SIGINT', () => {
  katagoProcess?.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  katagoProcess?.kill();
  process.exit(0);
});
