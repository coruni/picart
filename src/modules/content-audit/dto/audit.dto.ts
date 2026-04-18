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
  action?: 'pass' | 'review' | 'block';
  scene?: string;
  label?: string;
  confidence?: number;
  suggestion?: string;
  reason?: string;
  details?: Record<string, any>;
}

export interface TextAuditRequest {
  content: string;
  userId?: number;
  scene?: string;
  type?: 'comment' | 'article' | 'nickname' | 'chat';
}

export interface ImageAuditRequest {
  url: string;
  userId?: number;
  scene?: string;
  type?: 'avatar' | 'image' | 'article';
}
