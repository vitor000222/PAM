import axios from "axios";

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

const API_URL = "http://localhost:3001";

// Buscar todos os clientes
export const getClients = async (): Promise<Client[]> => {
  const res = await axios.get(`${API_URL}/clients`);
  return res.data;
};

// Buscar cliente específico
export const getClientById = async (id: string): Promise<Client> => {
  const res = await axios.get(`${API_URL}/clients/${id}`);
  return res.data;
};

// Criar cliente
export const createClient = async (client: Omit<Client, "id">): Promise<Client> => {
  const res = await axios.post(`${API_URL}/clients`, client);
  return res.data;
};
