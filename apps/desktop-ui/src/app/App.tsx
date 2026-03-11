import { BrowserRouter } from "react-router-dom";

import { LocaleProvider } from "./providers/LocaleProvider.js";
import { OverviewProvider } from "./providers/OverviewProvider.js";
import { WorkspaceProvider } from "./providers/WorkspaceProvider.js";
import { AppRoutes } from "./routes.js";

export default function App() {
  return (
    <LocaleProvider>
      <OverviewProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </WorkspaceProvider>
      </OverviewProvider>
    </LocaleProvider>
  );
}
