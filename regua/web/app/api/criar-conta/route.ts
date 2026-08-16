import { criarContaEEntrar } from '@/lib/sessao';
import { apos } from '@/lib/redirecionar';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Mesmo padrão de /api/entrar: Route Handler, não Server Action — cookie de
   sessão precisa chegar de verdade atrás do proxy da Render. */
export async function POST(req: Request) {
  const form = await req.formData();
  const nomeConta = String(form.get('nomeConta') ?? '').trim();
  const nomeUsuario = String(form.get('nome') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const senha = String(form.get('senha') ?? '');

  if (!nomeConta || !nomeUsuario || !EMAIL_RE.test(email) || senha.length < 8) {
    return apos(req, '/criar-conta?erro=invalido');
  }

  const resultado = await criarContaEEntrar({ nomeConta, nomeUsuario, email, senha });
  if (!resultado) return apos(req, '/criar-conta?erro=email-em-uso');

  return apos(req, '/painel/instalar');
}
