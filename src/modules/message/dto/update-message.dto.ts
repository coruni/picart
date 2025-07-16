export class UpdateMessageDto {
  content?: string;
  isRead?: boolean;
  type?: 'private' | 'system' | 'notification';
  isBroadcast?: boolean;
}
