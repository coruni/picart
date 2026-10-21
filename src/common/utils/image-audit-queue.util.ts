import { JobOptions, Queue } from "bull";

export const IMAGE_AUDIT_JOB_PREFIX = "image-audit:";

export interface ImageAuditTarget {
  id: number;
  url: string;
  hash?: string | null;
}

const IMAGE_AUDIT_JOB_OPTIONS: JobOptions = {
  attempts: 10,
  backoff: {
    type: "fixed",
    delay: 5000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

export function buildImageAuditJobId(uploadId: number): string {
  return `${IMAGE_AUDIT_JOB_PREFIX}${uploadId}`;
}

function isDuplicateJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Job already exists");
}

/**
 * 入队单个图片审核任务。jobId 保证幂等，重复入队视为成功。
 */
export async function enqueueImageAudit(
  queue: Queue,
  upload: ImageAuditTarget,
  userId?: number,
): Promise<void> {
  try {
    await queue.add(
      {
        uploadId: upload.id,
        url: upload.url,
        hash: upload.hash,
        userId,
      },
      {
        ...IMAGE_AUDIT_JOB_OPTIONS,
        jobId: buildImageAuditJobId(upload.id),
      },
    );
  } catch (error) {
    if (!isDuplicateJobError(error)) {
      throw error;
    }
  }
}

/**
 * 批量入队，保持原有「逐个入队、任一失败向上抛」的语义。
 */
export async function enqueueImageAudits(
  queue: Queue,
  uploads: ImageAuditTarget[],
  userId?: number,
): Promise<void> {
  for (const upload of uploads) {
    await enqueueImageAudit(queue, upload, userId);
  }
}
