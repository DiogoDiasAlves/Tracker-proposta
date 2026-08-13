/* Cria o primeiro usuário e o liga à conta.
     node tools/criar-usuario.js email@exemplo.com "senha" "Nome" [slug-da-conta] */
import { pool } from '../db/index.js';
import { criarUsuario } from '../db/auth.js';

const [email, senha, nome, slug = 'diogo'] = process.argv.slice(2);
if (!email || !senha) {
  console.error('uso: node tools/criar-usuario.js <email> <senha> [nome] [slug]');
  process.exit(1);
}
if (senha.length < 8) { console.error('senha precisa de ao menos 8 caracteres'); process.exit(1); }

const db = pool();
const id = await criarUsuario(db, { email, nome, senha, accountSlug: slug });
console.log(`usuário #${id} <${email}> ligado à conta "${slug}"`);
await db.end();
