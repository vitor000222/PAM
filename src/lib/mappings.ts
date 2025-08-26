import axios from "axios";

export interface Mapping {
  id: string;
  projetoId: string;
  nome: string;
  tipo: string; // "AS_IS" | "TO_BE"
  xml: string;
}

const API_URL = "http://localhost:3001";

// Buscar todos os mapeamentos de um projeto
export const getMappingsByProject = async (projetoId: string): Promise<Mapping[]> => {
  const res = await axios.get(`${API_URL}/projetos/${projetoId}/mapeamentos`);
  return res.data;
};

// Buscar mapeamento por ID
export const getMappingById = async (id: string): Promise<Mapping> => {
  const res = await axios.get(`${API_URL}/mapeamentos/${id}`);
  return res.data;
};

// Criar novo mapeamento dentro de um projeto
export const createMapping = async (
  projetoId: string,
  nome: string,
  tipo: string = "AS_IS",
  xml?: string
): Promise<Mapping> => {
  const res = await axios.post(`${API_URL}/projetos/${projetoId}/mapeamentos`, {
    nome,
    tipo,
    xml,
  });
  return res.data;
};

// Salvar alterações em mapeamento existente
export const saveMapping = async (id: string, xml: string): Promise<{ success: boolean }> => {
  const res = await axios.post(`${API_URL}/mapeamentos`, { id, xml });
  return res.data;
};
