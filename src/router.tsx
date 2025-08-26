// src/router.tsx
import { createBrowserRouter } from "react-router-dom";

// Layout privado (Sidebar + Outlet)
import App from "./App";

// Guard de autenticação
import RequireAuth from "./components/RequireAuth";

// Páginas já existentes
import Dashboard from "./pages/Dashboard";
import ClientsPage from "./pages/Clients";
import NewProject from "./pages/NewProject";
import ProjectPage from "./pages/ProjectPage";
import ModelerStart from "./pages/ModelerStart";
import Modeler from "./pages/Modeler";
// ❌ import ModelerNew from "./pages/ModelerNew";
import NotFound from "./pages/NotFound";

// ✅ pages já existentes (mantidas)
import ProjectMappings from "./pages/projects/ProjectMappings";
import MappingCreate from "./pages/mappings/MappingCreate";

// ✅ novas páginas de conta/usuário (opcionais, mas recomendadas)
import LoginPage from "./pages/Login";
import ProfilePage from "./pages/Profile";
import AccountTeamPage from "./pages/AccountTeam";

const router = createBrowserRouter([
  // ROTA PÚBLICA (sem Sidebar/App)
  { path: "/login", element: <LoginPage /> },

  // BLOCO PRIVADO (tudo que exige sessão) sob o layout App
  {
    path: "/",
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      // Dashboard
      { path: "/", element: <Dashboard /> },
      { path: "/dashboard", element: <Dashboard /> },

      // Clientes & Projetos
      { path: "/clients", element: <ClientsPage /> },

      // Novo projeto (pt/en para não quebrar alias)
      { path: "/new-project", element: <NewProject /> },
      { path: "/projects/new", element: <NewProject /> },

      // Página do projeto
      { path: "/projetos/:id", element: <ProjectPage /> },

      // Lista de mapeamentos do projeto
      { path: "/projetos/:id/mapeamentos", element: <ProjectMappings /> },

      // Fluxo do Modeler
      { path: "/modeler/start", element: <ModelerStart /> },

      // Cadastrar mapeamento (form)
      { path: "/projetos/:id/mapeamentos/new", element: <MappingCreate /> },

      // Abrir um mapeamento no modeler
      { path: "/modeler/:id", element: <Modeler /> },

      // Conta/Usuário (se não quiser agora, pode remover estas duas linhas)
      { path: "/perfil", element: <ProfilePage /> },
      { path: "/conta/equipe", element: <AccountTeamPage /> },

      // catch-all interno
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default router;
