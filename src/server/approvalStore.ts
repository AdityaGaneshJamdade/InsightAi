import { RecommendationDecision } from './types.js';

class ApprovalStore {
  private recommendations: Map<string, RecommendationDecision> = new Map();

  constructor() {
    // Production ready: Empty queue until queries formulate actionable recommendations
  }

  public getAll(): RecommendationDecision[] {
    return Array.from(this.recommendations.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): RecommendationDecision | undefined {
    return this.recommendations.get(id);
  }

  public addMany(items: RecommendationDecision[]) {
    for (const item of items) {
      this.recommendations.set(item.id, item);
    }
  }

  /**
   * Adds recommendations only when their query has not already produced cards,
   * so resubmitting the same query does not duplicate the queue.
   */
  public addManyForQuery(queryId: string | undefined, items: RecommendationDecision[]) {
    if (queryId && Array.from(this.recommendations.values()).some((item) => item.queryId === queryId)) {
      return [];
    }
    this.addMany(items);
    return items;
  }

  public updateStatus(
    id: string,
    status: 'approved' | 'edited' | 'rejected',
    updates?: {
      title?: string;
      description?: string;
      reviewerNotes?: string;
      reviewedBy?: string;
      impactLevel?: 'High' | 'Medium' | 'Low';
      urgency?: 'Immediate' | 'Short-Term' | 'Strategic';
    }
  ): RecommendationDecision | null {
    const existing = this.recommendations.get(id);
    if (!existing) return null;

    const updated: RecommendationDecision = {
      ...existing,
      status,
      title: updates?.title || existing.title,
      description: updates?.description || existing.description,
      reviewerNotes: updates?.reviewerNotes || existing.reviewerNotes,
      reviewedBy: updates?.reviewedBy || existing.reviewedBy || 'Enterprise Business Owner',
      reviewedAt: new Date().toISOString(),
      impactLevel: updates?.impactLevel || existing.impactLevel,
      urgency: updates?.urgency || existing.urgency,
    };

    this.recommendations.set(id, updated);
    return updated;
  }

  public remove(id: string): boolean {
    return this.recommendations.delete(id);
  }

  public clearAll() {
    this.recommendations.clear();
  }

  public seedDefaultRecommendations() {
    this.clearAll();
  }
}

export const approvalStore = new ApprovalStore();
