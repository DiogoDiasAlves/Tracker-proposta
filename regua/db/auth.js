/*
 * Login.
 *
 * Sem biblioteca, mas também sem invenção: scrypt do próprio Node para a
 * senha, token aleatório de 32 bytes para a sessão, e no banco só o hash do
 * token. As três decisões que erram na mão são hash fraco, token previsível
 * e token gravado em claro — nenhuma delas está aqui.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const N = 32;
const DIAS = 30;

export async function hashSenha(senha) {
  const sal = randomBytes(16);
  const chave = await scrypt(senha, sal, N);
  return `scrypt$${sal.toString('hex')}$${chave.toString('hex')}`;
}

export async function conferirSenha(senha, guardado) {
  if (!guardado || !guardado.startsWith('scrypt$')) return false;
  const [, salHex, chaveHex] = guardado.split('$');
  const chave = await scrypt(senha, Buffer.from(salHex, 'hex'), N);
  const esperado = Buffer.from(chaveHex, 'hex');
  // comparação em tempo constante: comparar com === vaza o tamanho do acerto
  return chave.length === esperado.length && timingSafeEqual(chave, esperado);
}

const hashToken = t => createHash('sha256').update(t).digest('hex');

export async function criarSessao(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DIAS * 86400000);
  await db.query(
    'INSERT INTO user_sessions (token_hash, user_id, expira_em) VALUES ($1,$2,$3)',
    [hashToken(token), userId, expira]
  );
  return { token, expira };
}

export async function usuarioDaSessao(db, token) {
  if (!token) return null;
  const { rows } = await db.query(`
    SELECT u.id, u.email, u.name, u.is_admin, (u.tour_concluido_em IS NOT NULL) AS tour_concluido
    FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expira_em > now()
  `, [hashToken(token)]);
  return rows[0] ?? null;
}

export async function concluirTour(db, userId) {
  await db.query('UPDATE users SET tour_concluido_em = now() WHERE id = $1', [userId]);
}

export async function encerrarSessao(db, token) {
  if (!token) return;
  await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
}

/** Conta a que o usuário pertence. Toda leitura do painel passa por aqui. */
export async function contaDoUsuario(db, userId) {
  const { rows } = await db.query(`
    SELECT a.id, a.name, a.slug FROM accounts a
    JOIN memberships m ON m.account_id = a.id
    WHERE m.user_id = $1 ORDER BY a.id LIMIT 1
  `, [userId]);
  return rows[0] ?? null;
}

function slugify(s) {
  const base = s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return base || 'conta';
}

/** Cadastro público (self-signup): conta + site key + usuário dono, numa
 *  transação. Devolve null se o e-mail já está em uso — nunca sobrescreve
 *  senha de quem já existe (isso seria dar a um estranho como resetar a
 *  senha de outra pessoa só sabendo o e-mail dela). O slug nasce do nome da
 *  conta, sem perguntar; se colidir, ganha um sufixo numérico. */
export async function criarConta(db, { nomeConta, email, senha, nomeUsuario }) {
  const emailNorm = email.toLowerCase().trim();
  const c = await db.connect();
  try {
    await c.query('BEGIN');

    const existe = await c.query('SELECT 1 FROM users WHERE email = $1', [emailNorm]);
    if (existe.rowCount) { await c.query('ROLLBACK'); return null; }

    const base = slugify(nomeConta);
    let slug = base, n = 1;
    // eslint-disable-next-line no-await-in-loop
    while ((await c.query('SELECT 1 FROM accounts WHERE slug = $1', [slug])).rowCount) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const accountId = (await c.query(
      'INSERT INTO accounts (name, slug) VALUES ($1,$2) RETURNING id', [nomeConta, slug]
    )).rows[0].id;

    const siteKey = `rg_${randomBytes(9).toString('base64url')}`;
    await c.query(
      `INSERT INTO api_keys (account_id, site_key, name) VALUES ($1,$2,'chave inicial')`,
      [accountId, siteKey]
    );

    const hash = await hashSenha(senha);
    let userId;
    try {
      userId = (await c.query(
        `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3) RETURNING id`,
        [emailNorm, nomeUsuario || null, hash]
      )).rows[0].id;
    } catch (e) {
      // corrida: dois cadastros com o mesmo e-mail passaram do SELECT juntos
      if (e.code === '23505') { await c.query('ROLLBACK'); return null; }
      throw e;
    }

    await c.query(
      `INSERT INTO memberships (account_id, user_id, role) VALUES ($1,$2,'owner')`,
      [accountId, userId]
    );

    await c.query('COMMIT');
    return { accountId, userId, slug, siteKey };
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

export async function criarUsuario(db, { email, nome, senha, accountSlug }) {
  const hash = await hashSenha(senha);
  const { rows } = await db.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash,
                                       name = COALESCE(EXCLUDED.name, users.name)
     RETURNING id`,
    [email.toLowerCase().trim(), nome ?? null, hash]
  );
  const userId = rows[0].id;
  const conta = (await db.query('SELECT id FROM accounts WHERE slug = $1', [accountSlug])).rows[0];
  if (conta) {
    await db.query(
      `INSERT INTO memberships (account_id, user_id, role) VALUES ($1,$2,'owner')
       ON CONFLICT (account_id, user_id) DO NOTHING`,
      [conta.id, userId]
    );
  }
  return userId;
}
