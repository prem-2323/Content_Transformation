import { apiClient } from './client';

export interface ResultsExportRequest {
  outputs: Record<string, unknown>;
  active_channel?: string;
  validation_report?: Record<string, unknown>;
  format: 'all' | 'structured';
}

export const resultsApi = {
  export: async (data: ResultsExportRequest) => {
    const response = await apiClient.post('/results/export', data, {
      responseType: 'blob',
      timeout: 30000,
    });
    const disposition = response.headers['content-disposition'] || '';
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
      || (data.format === 'all' ? 'contentforge_all_deliverables.md' : 'deliverable_structured.md');
    return { blob: response.data as Blob, filename };
  },
};