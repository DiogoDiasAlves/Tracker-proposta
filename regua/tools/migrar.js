/* Aplica migrações pendentes em db/migrations/ — idempotente, só roda o que
 * ainda não está na tabela _migrations. É o script certo pra produção
 * (tools/migrar-sqlite.js é só para a importação única do SQLite original).
 *
 *   node tools/migrar.js
 */
import { pool, migrate } from '../db/index.js';

const db = pool();
const novas = await migrate(db);
console.log(novas.length ? `aplicadas: ${novas.join(', ')}` : 'nada pendente — banco já atualizado');
await db.end();
