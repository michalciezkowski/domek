// Czyste reguły uprawnień zadań (współdzielone przez UI i testy jednostkowe).
export const canCompleteTask = (t: { assignee?: string }, myId: string): boolean =>
  !t.assignee || t.assignee === myId;

export const canDeleteTask = (t: { createdBy?: string }, myId: string): boolean =>
  t.createdBy === myId;
