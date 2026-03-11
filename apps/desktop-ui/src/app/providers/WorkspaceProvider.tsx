import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

import {
  defaultWorkspaceState,
  saveWorkspaceState,
  type WorkspaceState,
  loadWorkspaceState,
  type DigitalEmployee,
  type WorkspaceActivity,
  type WorkspaceSkillDraft
} from "../../shared/state/workspace-store.js";

interface WorkspaceContextValue {
  state: WorkspaceState;
  update: (updater: (current: WorkspaceState) => WorkspaceState) => void;
  addEmployee: (employee: DigitalEmployee) => void;
  updateEmployee: (employeeId: string, updater: (employee: DigitalEmployee) => DigitalEmployee) => void;
  addActivity: (item: WorkspaceActivity) => void;
  saveSkillDraft: (draft: WorkspaceSkillDraft) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider(props: PropsWithChildren) {
  const [state, setState] = useState<WorkspaceState>(() => loadWorkspaceState() ?? defaultWorkspaceState);

  function commit(next: WorkspaceState) {
    saveWorkspaceState(next);
    setState(next);
  }

  const value = useMemo(
    () => ({
      state,
      update(updater: (current: WorkspaceState) => WorkspaceState) {
        commit(updater(state));
      },
      addEmployee(employee: DigitalEmployee) {
        commit({
          ...state,
          employees: [employee, ...state.employees]
        });
      },
      updateEmployee(employeeId: string, updater: (employee: DigitalEmployee) => DigitalEmployee) {
        commit({
          ...state,
          employees: state.employees.map((employee) =>
            employee.id === employeeId ? updater(employee) : employee
          )
        });
      },
      addActivity(item: WorkspaceActivity) {
        commit({
          ...state,
          activity: [item, ...state.activity].slice(0, 12)
        });
      },
      saveSkillDraft(draft: WorkspaceSkillDraft) {
        const existing = state.customSkillDrafts.filter((item) => item.id !== draft.id);
        commit({
          ...state,
          customSkillDrafts: [draft, ...existing]
        });
      }
    }),
    [state]
  );

  return <WorkspaceContext.Provider value={value}>{props.children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);

  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }

  return value;
}
