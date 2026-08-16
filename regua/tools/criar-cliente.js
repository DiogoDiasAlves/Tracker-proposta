/* Provisiona um cliente novo do zero: conta + site key + usuário dono, tudo
 * numa tacada, e imprime o que precisa ser repassado a ele (login e o
 * <script> de instalação já com a key certa).
 *
 *   node tools/criar-cliente.js <slug> "<Nome da conta>" <email> <senha> ["Nome do usuário"]
 *
 * slug é o identificador da conta (sem espaço, ex.: "socio", "cliente-x") —
 * cada cliente tem o seu, nunca reaproveita o de outro.
 */
import { randomBytes } from 'node:crypto';
import { pool } from '../db/index.js';
import { criarUsuario } from '../db/auth.js';

const [slug, nomeConta, email, senha, nomeUsuario] = process.argv.slice(2);

if (!slug || !nomeConta || !email || !senha) {
  console.error(
    'uso: node tools/criar-cliente.js <slug> "<Nome da conta>" <email> <senha> ["Nome do usuário"]'
  );
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(slug)) { console.error('slug só pode ter minúsculas, número e hífen'); process.exit(1); }
if (senha.length < 8) { console.error('senha precisa de ao menos 8 caracteres'); process.exit(1); }

const db = pool();

const contaExistente = (await db.query('SELECT id FROM accounts WHERE slug = $1', [slug])).rows[0];
if (contaExistente) {
  console.error(`já existe uma conta com slug "${slug}" (id ${contaExistente.id}) — escolha outro slug`);
  process.exit(1);
}

const accountId = (await db.query(
  'INSERT INTO accounts (name, slug) VALUES ($1, $2) RETURNING id', [nomeConta, slug]
)).rows[0].id;

// Aleatória, independente do slug: o slug aparece na tela do próprio cliente
// (@slug no topo do painel), a site key não pode ser adivinhável a partir dele.
const siteKey = `rg_${randomBytes(9).toString('base64url')}`;
await db.query(
  `INSERT INTO api_keys (account_id, site_key, name) VALUES ($1, $2, 'chave inicial')`,
  [accountId, siteKey]
);

const userId = await criarUsuario(db, { email, nome: nomeUsuario ?? null, senha, accountSlug: slug });

const host = process.env.REGUA_HOST || 'http://localhost:3100';
console.log(`
conta criada: "${nomeConta}" (id ${accountId}, slug "${slug}")
usuário dono: #${userId} <${email}>

── login ──────────────────────────────────────────────
  ${host}/entrar
  e-mail: ${email}
  senha:  (a que você passou)

── script de instalação ──────────────────────────────
<script src="${host}/r.js"
        data-key="${siteKey}"
        data-page="NOME-DA-PAGINA"
        data-version="1" defer></script>

(o painel também gera este bloco, já preenchido, em /painel/instalar
 depois que ${email} fizer login)
`);

await db.end();
