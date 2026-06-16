import { AuditAction, AuditEntityType, AuditLogChange, AuditLogEntry, CurrentUser } from '../types';
import { createEntityId } from './hotelState';

const stringifyAuditValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

export const buildAuditChanges = (before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined): AuditLogChange[] => {
  const keys = new Set<string>([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);

  return [...keys]
    .filter((key) => stringifyAuditValue(before?.[key]) !== stringifyAuditValue(after?.[key]))
    .map((key) => ({
      field: key,
      previousValue: stringifyAuditValue(before?.[key]),
      newValue: stringifyAuditValue(after?.[key]),
    }));
};

export const createAuditLogEntry = ({
  actor,
  action,
  entityType,
  entityId,
  entityLabel,
  before,
  after,
  changes,
}: {
  actor: CurrentUser;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: AuditLogChange[];
}): AuditLogEntry => ({
  id: createEntityId('AUD'),
  action,
  entityType,
  entityId,
  entityLabel,
  actorEmail: actor.email,
  actorRole: actor.role,
  createdAt: new Date().toISOString(),
  changes: changes || buildAuditChanges(before || {}, after || {}),
});
