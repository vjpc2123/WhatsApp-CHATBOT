import "./env-loader";
import { getOrCreateConversation, insertMessage, getRecentHistory, getMessages } from "../src/lib/db";
import { generateReply } from "../src/lib/openrouter";

async function main() {
  const phone = "50900000001";
  const testMsg = "Hola, ¿me puedes ayudar con información sobre sus servicios?";

  console.log("\n=== TEST DE FLUJO COMPLETO ===\n");

  // 1. Crear conversación
  const convo = getOrCreateConversation(phone, "Usuario de Prueba");
  console.log(`[1] Conversación creada/obtenida: id=${convo.id} phone=${convo.phone} mode=${convo.mode}`);

  // 2. Insertar mensaje entrante
  insertMessage(convo.id, "user", testMsg);
  console.log(`[2] Mensaje insertado: "${testMsg}"`);

  // 3. Obtener historial
  const history = getRecentHistory(convo.id, 20);
  console.log(`[3] Historial: ${history.length} mensajes`);

  // 4. Llamar al LLM
  console.log("[4] Llamando a Azure OpenAI...");
  const start = Date.now();
  try {
    const reply = await generateReply(history);
    const elapsed = Date.now() - start;
    console.log(`[4] Respuesta en ${elapsed}ms: "${reply}"`);

    // 5. Guardar respuesta
    insertMessage(convo.id, "assistant", reply);
    console.log("[5] Respuesta guardada en DB");

    // 6. Verificar mensajes en DB
    const all = getMessages(convo.id, 10);
    console.log(`\n[6] Mensajes en DB para conversación ${convo.id}:`);
    all.forEach(m => console.log(`    [${m.role}] ${m.content}`));

    console.log("\n✓ FLUJO COMPLETO OK — Abre http://localhost:3000 para ver la conversación");
  } catch (err) {
    console.error("[ERROR] Fallo al llamar al LLM:", err);
  }
}

main();
