// src/utils/localSession.ts

/**
 * Salva o XML no sessionStorage usando o id do mapeamento.
 */
export function saveXmlToSession(id: string, xml: string) {
  try {
    sessionStorage.setItem(`bpmn-xml-${id}`, xml);
  } catch (err) {
    console.error("Erro ao salvar XML no sessionStorage:", err);
  }
}

/**
 * Carrega o XML salvo no sessionStorage.
 * Retorna null se não existir ou se der erro.
 */
export function loadXmlFromSession(id: string): string | null {
  try {
    return sessionStorage.getItem(`bpmn-xml-${id}`);
  } catch (err) {
    console.error("Erro ao carregar XML do sessionStorage:", err);
    return null;
  }
}
