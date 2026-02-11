import type { AuditEvent } from '../types';
import type { EventCategory } from '../types';

const EVENT_TO_CATEGORY: Record<string, EventCategory> = {
  'Create Project': 'project',
  'Clone Project': 'project',
  'Archive Project': 'project',
  'Create Dataset': 'data',
  'Upload Files to Dataset': 'data',
  'Create Dataset Snapshot': 'data',
  'Start Workspace': 'execution',
  'Stop Workspace': 'execution',
  'Launch Job': 'execution',
  'Run Job': 'execution',
  'Create File': 'file',
  'Edit File': 'file',
  'Delete File': 'file',
  'Create Governance Bundle': 'governance',
  'Stage changes': 'governance',
  'Approve': 'governance',
  'Create Environment': 'environment',
  'Edit Environment': 'environment',
  'Add User': 'user',
  'Remove User': 'user',
};

const TARGET_TYPE_TO_CATEGORY: Record<string, EventCategory> = {
  Project: 'project',
  Dataset: 'data',
  Job: 'execution',
  Workspace: 'execution',
  File: 'file',
  Environment: 'environment',
  User: 'user',
};

export function getEventCategory(event: AuditEvent): EventCategory {
  const name = (event.event || '').trim();
  const fromName = EVENT_TO_CATEGORY[name];
  if (fromName) return fromName;
  const targetType = (event.targetType || '').trim();
  const fromTarget = TARGET_TYPE_TO_CATEGORY[targetType];
  if (fromTarget) return fromTarget;
  if (/project|clone|archive/i.test(name)) return 'project';
  if (/dataset|upload|snapshot/i.test(name)) return 'data';
  if (/workspace|job|run|launch|execution/i.test(name)) return 'execution';
  if (/file|upload|edit|delete/i.test(name)) return 'file';
  if (/governance|bundle|approval|stage/i.test(name)) return 'governance';
  if (/environment|env/i.test(name)) return 'environment';
  if (/user|member/i.test(name)) return 'user';
  return 'default';
}
