import 'server-only';
import { db } from './dados';
import { listarContas, detalheConta, resumoGeral } from '@regua/db/admin';

export type ContaResumo = {
  id: number; name: string; slug: string; criadaEm: string;
  usuarios: number; paginas: number; vsls: number; quizzes: number;
  sessoes: number; sessoes7d: number;
  ultimaAtividade: string | null; metaConectada: boolean;
};

export type ContaDetalhe = {
  id: number; name: string; slug: string; criadaEm: string;
  usuarios: { id: number; email: string; name: string | null; role: string; created_at: string }[];
  ativos: { key: string; kind: string; name: string | null; sessoes: number; ultima: string | null }[];
};

export type ResumoGeral = {
  contas: number; sessoes: number; sessoes7d: number; contasAtivas7d: number;
};

export const contas = () => listarContas(db) as Promise<ContaResumo[]>;
export const conta = (id: number) => detalheConta(db, id) as Promise<ContaDetalhe | null>;
export const resumo = () => resumoGeral(db) as Promise<ResumoGeral>;
