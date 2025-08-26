import axios from "axios";

export interface Project {
  id: string;
  nome: string;
  status: string;
  team?: string;
  hasAsIs?: boolean;
  hasToBe?: boolean;
  clienteId?: string;
  clienteNome?: string; // backend devolve clientName
}

const API_URL = "http://localhost:3001";

// Buscar todos os projetos
export const getProjects = async (): Promise<Project[]> => {
  const res = await axios.get(`${API_URL}/projetos`);
  return res.data;
};

// Buscar projeto por ID
export const getProjectById = async (id: string): Promise<Project> => {
  const res = await axios.get(`${API_URL}/projetos/${id}`);
  return res.data;
};

// Criar novo projeto
export const createProject = async (
  nome: string,
  clienteId: string,
  status: string = "Novo",
  team?: string
): Promise<Project> => {
  const res = await axios.post(`${API_URL}/projetos`, {
    nome,
    clienteId,
    status,
    team,
  });
  return res.data;
};

// Buscar todos os clientes (para popular dropdown no NewProject)
export const getClients = async () => {
  const res = await axios.get(`${API_URL}/clientes`);
  return res.data;
};
