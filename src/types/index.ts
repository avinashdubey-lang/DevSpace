export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  labels: string[];
  dueDate: string;
  assignee: string;
  completed: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  iconClass: string;
  statusText: string;
}

export type ActiveView =
  | 'overview'
  | 'projects'
  | 'tasks'
  | 'issues'
  | 'focus'
  | 'inbox'
  | 'calendar'
  | 'analytics'
  | 'settings'
  | 'new-project';

export type TaskSort = 'default' | 'priority';
