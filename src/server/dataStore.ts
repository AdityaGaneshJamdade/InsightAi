import { StructuredDataset, UnstructuredDataset } from './types.js';

class DataStore {
  private structuredDatasets: Map<string, StructuredDataset> = new Map();
  private unstructuredDatasets: Map<string, UnstructuredDataset> = new Map();

  constructor() {
    // Production ready: Clean empty store awaiting user datasets (CSV, Excel, PDF)
  }

  public getStructuredDatasets(): StructuredDataset[] {
    return Array.from(this.structuredDatasets.values());
  }

  public getUnstructuredDatasets(): UnstructuredDataset[] {
    return Array.from(this.unstructuredDatasets.values());
  }

  public addStructuredDataset(dataset: StructuredDataset) {
    this.structuredDatasets.set(dataset.id, dataset);
  }

  public addUnstructuredDataset(dataset: UnstructuredDataset) {
    this.unstructuredDatasets.set(dataset.id, dataset);
  }

  public removeDataset(id: string): boolean {
    const deletedStruct = this.structuredDatasets.delete(id);
    const deletedUnstruct = this.unstructuredDatasets.delete(id);
    return deletedStruct || deletedUnstruct;
  }

  public clearAll() {
    this.structuredDatasets.clear();
    this.unstructuredDatasets.clear();
  }

  public resetToDefault() {
    this.clearAll();
  }
}

export const dataStore = new DataStore();
