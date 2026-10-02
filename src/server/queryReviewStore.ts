import { QueryAnalysisResult, QueryReviewItem, QueryReviewStatus } from './types.js';

class QueryReviewStore {
  private items: Map<string, QueryReviewItem> = new Map();
  private queryIdIndex: Map<string, string> = new Map();

  public getAll(): QueryReviewItem[] {
    return Array.from(this.items.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): QueryReviewItem | undefined {
    return this.items.get(id);
  }

  public findByQueryId(queryId: string): QueryReviewItem | undefined {
    const id = this.queryIdIndex.get(queryId);
    return id ? this.items.get(id) : undefined;
  }

  public hasQuery(queryId: string): boolean {
    return this.queryIdIndex.has(queryId);
  }

  /** Returns the existing item when the query was already submitted, so repeat clicks stay idempotent. */
  public addFromAnalysis(analysis: QueryAnalysisResult): { item: QueryReviewItem; created: boolean } {
    const existing = this.findByQueryId(analysis.id);
    if (existing) {
      return { item: existing, created: false };
    }

    const item: QueryReviewItem = {
      id: `qr-${analysis.id}`,
      queryId: analysis.id,
      query: analysis.query,
      status: 'pending',
      createdAt: new Date().toISOString(),
      analysis,
    };

    this.items.set(item.id, item);
    this.queryIdIndex.set(item.queryId, item.id);
    return { item, created: true };
  }

  public updateStatus(
    id: string,
    status: QueryReviewStatus,
    updates?: { reviewedBy?: string; reviewerNotes?: string }
  ): QueryReviewItem | null {
    const existing = this.items.get(id);
    if (!existing) return null;

    const updated: QueryReviewItem = {
      ...existing,
      status,
      reviewedBy: updates?.reviewedBy || existing.reviewedBy || 'Enterprise Business Owner',
      reviewerNotes: updates?.reviewerNotes || existing.reviewerNotes,
      reviewedAt: new Date().toISOString(),
    };

    this.items.set(id, updated);
    return updated;
  }

  public remove(id: string): boolean {
    const existing = this.items.get(id);
    if (!existing) return false;
    this.queryIdIndex.delete(existing.queryId);
    return this.items.delete(id);
  }

  public clearAll() {
    this.items.clear();
    this.queryIdIndex.clear();
  }
}

export const queryReviewStore = new QueryReviewStore();