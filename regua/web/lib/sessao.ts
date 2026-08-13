import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './dados';
import { usuarioDaSessao, contaDoUsuario, conferirSenha, criarSessao, encerrarSessao } from '@regua/db/auth';

export const COOKIE = 'rg_sessao';

export async function usuarioAtual() {
  const c = await cookies();
  return usuarioDaSessao(db, c.get(COOKIE)?.value ?? null) as
    Promise<{ id: number; email: string; name: string | null } | null>;
}

/* Toda página do painel chama isto. Se não há sessão válida, não há dado:
   o redirecionamento acontece ANTES de qualquer consulta, e a conta vem do
   vínculo do usuário — nunca de parâmetro de URL. */
export async function exigirConta() {
  const u = await usuarioAtual();
  if (!u) redirect('/entrar');
  const conta = await contaDoUsuario(db, u.id);
  if (!conta) redirect('/entrar?erro=sem-conta');
  return { usuario: u, conta: conta as { id: number; name: string; slug: string } };
}

export async function entrar(email: string, senha: string) {
  const { rows } = await db.query(
    'SELECT id, password_hash FROM users WHERE email = $1', [email.toLowerCase().trim()]
  );
  const u = rows[0];
  // Confere a senha mesmo sem usuário, contra um hash descartável: sem isso o
  // tempo de resposta revela quais e-mails existem.
  const ok = await conferirSenha(senha, u?.password_hash ?? 'scrypt$00$00');
  if (!u || !ok) return null;

  const { token, expira } = await criarSessao(db, u.id);
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expira,
  });
  return u.id as number;
}

export async function sair() {
  const c = await cookies();
  await encerrarSessao(db, c.get(COOKIE)?.value ?? null);
  c.delete(COOKIE);
}
