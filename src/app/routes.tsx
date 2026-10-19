import { Navigate, Outlet, createBrowserRouter } from "react-router";
import { AppShell } from "./Layout";
import { StoreProvider, useStore } from "./store";
import { HelpPage } from "./pages/HelpPage";
import { DraftsPage, HistoryDetailPage, HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotePage } from "./pages/NotePage";
import { PatientPage } from "./pages/PatientsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Root() {
  return (
    <StoreProvider>
      <Outlet />
    </StoreProvider>
  );
}

function IndexRoute() {
  const { authenticated } = useStore();
  return <Navigate replace to={authenticated ? "/utama" : "/login"} />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: IndexRoute },
      { path: "login", Component: LoginPage },
      {
        Component: AppShell,
        children: [
          { path: "utama", Component: HomePage },
          { path: "pesakit/:patientId", Component: PatientPage },
          { path: "pesakit/:patientId/lawatan-baharu", Component: NotePage },
          { path: "rekod", Component: HistoryPage },
          { path: "rekod/draf", Component: DraftsPage },
          { path: "rekod/:recordId", Component: HistoryDetailPage },
          { path: "bantuan", Component: HelpPage },
          { path: "tetapan", Component: SettingsPage },
        ],
      },
      { path: "*", Component: IndexRoute },
    ],
  },
]);
