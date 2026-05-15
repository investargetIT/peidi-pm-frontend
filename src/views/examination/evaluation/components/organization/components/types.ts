export interface MetricConfig {
  id: number;
  nodeId: number;
  targetName: string;
  weight: number | null;
  score: number | null;
  calculationFormula: string;
  kpiDepict?: string;
  rate?: string;
  createdAt: string;
}

export interface TreeNode {
  id: number;
  parentId: number;
  parentName: string | null;
  nodeName: string;
  nodeType: "department" | "position" | "examination_group";
  sortNo: number;
  treeLevel: number;
  treePath: string;
  treePathName?: string;
  targetType: string | null;
  status: number;
  metricConfigs: MetricConfig[];
  children: TreeNode[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiResponse {
  code: number;
  msg: string;
  success: boolean;
  data: {
    records: TreeNode[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
}
