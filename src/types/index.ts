export interface SubItem {
  id: string;
  concept: string;
  quantity: number;
  unit: string;
  unitValue: number;
}

export interface Asset {
  id: string;
  name: string;
  divisible: boolean;
  subItems: SubItem[];
}

export interface Configuration {
  numberOfHeirs: number;
  currency: string;
}

export interface AppState {
  config: Configuration;
  assets: Asset[];
}

// AI Response Types
export interface AllocationItem {
  assetName: string;
  description: string;
  value: number;
}

export interface HeirAllocation {
  heirId: number;
  heirName: string;
  items: AllocationItem[];
  totalAllocatedValue: number;
  balanceDifference: number;
}

export interface Compensation {
  from: string;
  to: string;
  amount: number;
}

export interface PartitionResult {
  totalEstateValue: number;
  idealShare: number;
  allocations: HeirAllocation[];
  compensations: Compensation[];
  explanation: string;
}
