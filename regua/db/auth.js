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
    SELECT u.id, u.email, u.name
    FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expira_em > now()
  `, [hashToken(token)]);
  return rows[0] ?? null;
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
