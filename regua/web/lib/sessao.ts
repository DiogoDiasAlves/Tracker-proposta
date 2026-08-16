import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { db } from './dados';
import {
  usuarioDaSessao, contaDoUsuario, conferirSenha, criarSessao, encerrarSessao,
  criarConta, concluirTour,
} from '@regua/db/auth';

export const COOKIE = 'rg_sessao';

export async function usuarioAtual() {
  const c = await cookies();
  return usuarioDaSessao(db, c.get(COOKIE)?.value ?? null) as
    Promise<{ id: number; email: string; name: string | null; is_admin: boolean; tour_concluido: boolean } | null>;
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

/* Painel /admin lê TODAS as contas, de propósito — o único lugar do código
   onde isso é correto. Chega lá só quem tem is_admin; 404 (não 403) pra
   quem não tem, pra não confirmar pra um usuário comum que a rota existe. */
export async function exigirAdmin() {
  const u = await usuarioAtual();
  if (!u) redirect('/entrar');
  if (!u.is_admin) notFound();
  return { usuario: u };
}

async function iniciarSessaoPara(userId: number) {
  const { token, expira } = await criarSessao(db, userId);
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expira,
  });
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

  await iniciarSessaoPara(u.id);
  return u.id as number;
}

/* Self-signup: conta + site key + usuário dono, e já loga. Devolve null se o
   e-mail já está em uso — criarConta() nunca sobrescreve senha de quem já
   existe (ver comentário lá). */
export async function criarContaEEntrar(dados: {
  nomeConta: string; email: string; senha: string; nomeUsuario: string;
}) {
  const resultado = await criarConta(db, dados) as
    { accountId: number; userId: number; slug: string; siteKey: string } | null;
  if (!resultado) return null;
  await iniciarSessaoPara(resultado.userId);
  return resultado;
}

export async function marcarTourConcluido() {
  const u = await usuarioAtual();
  if (!u) return;
  await concluirTour(db, u.id);
}

export async function sair() {
  const c = await cookies();
  await encerrarSessao(db, c.get(COOKIE)?.value ?? null);
  c.delete(COOKIE);
}
