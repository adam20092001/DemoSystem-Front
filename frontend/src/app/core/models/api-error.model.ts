export interface ApiError {
  errorCode: string;
  message: string;
  details?: Record<string, unknown>;
}
