/**
 * Build Domino deep links for "Open in Domino".
 * DOMINO_API_HOST is typically like https://se-demo.domino.tech; UI base is same host.
 */
export function getDominoBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}

export function buildProjectUrl(projectId: string): string {
  const base = getDominoBaseUrl();
  return `${base}/projects/${projectId}`;
}

export function buildJobUrl(projectId: string, jobId: string): string {
  const base = getDominoBaseUrl();
  return `${base}/projects/${projectId}/jobs/${jobId}`;
}

export function buildWorkspaceUrl(projectId: string, workspaceId?: string): string {
  const base = getDominoBaseUrl();
  if (workspaceId) {
    return `${base}/projects/${projectId}/workspace/${workspaceId}`;
  }
  return `${base}/projects/${projectId}/workspace`;
}

export function buildDatasetUrl(projectId: string, datasetId?: string): string {
  const base = getDominoBaseUrl();
  if (datasetId) {
    return `${base}/projects/${projectId}/datasets/${datasetId}`;
  }
  return `${base}/projects/${projectId}/datasets`;
}

export function buildUserProfileUrl(userId: string): string {
  const base = getDominoBaseUrl();
  return `${base}/users/${userId}`;
}

export function buildEventDeepLink(event: {
  targetType?: string;
  targetId?: string;
  withinProjectId?: string;
  metadata?: Record<string, unknown>;
}): string | null {
  const projectId = event.withinProjectId || (event.metadata?.projectId as string);
  const targetType = (event.targetType || '').toLowerCase();
  const targetId = event.targetId;

  if (!projectId) return null;
  if (targetType === 'project') return buildProjectUrl(targetId || projectId);
  if (targetType === 'job' && targetId) return buildJobUrl(projectId, targetId);
  if (targetType === 'workspace') return buildWorkspaceUrl(projectId, targetId);
  if (targetType === 'dataset' && targetId) return buildDatasetUrl(projectId, targetId);
  return buildProjectUrl(projectId);
}
