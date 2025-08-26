import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClients, createClient, Client } from "../lib/clients";
import { useState } from "react";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: getClients,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setName("");
      setEmail("");
    },
  });

  if (isLoading) return <p>Carregando clientes...</p>;

  return (
    <div className="p-6">
      <h2 className="mb-4 text-2xl font-bold">Clientes</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({ name, email });
        }}
        className="mb-6 flex gap-2"
      >
        <input
          type="text"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded w-1/3"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Adicionar
        </button>
      </form>

      <ul className="space-y-2">
        {clients.map((client) => (
          <li
            key={client.id}
            className="border rounded p-2 flex justify-between"
          >
            <span>
              <strong>{client.name}</strong> – {client.email}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
