export class CreateMessageDto {
  senderId: number;
  receiverId?: number; // 单发
  receiverIds?: number[]; // 批量
  content: string;
  type?: 'private' | 'system' | 'notification';
  isBroadcast?: boolean;
}
