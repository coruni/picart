export enum AuditProvider {
  TENCENT = 'tencent',
  ALIYUN = 'aliyun',
  NONE = 'none',
}

export enum AuditSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface AuditResult {
  passed: boolean;
  label?: string;
  confidence?: number;
  suggestion?: string;
  details?: Record<string, any>;
}

export interface TextAuditRequest {
  content: string;
  userId?: number;
  scene?: string;
}

export interface ImageAuditRequest {
  url: string;
  userId?: number;
  scene?: string;
}
