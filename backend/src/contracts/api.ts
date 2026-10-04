export type ApiErrorCode = "INTERNAL_ERROR" | "NOT_FOUND" | "SERVICE_UNAVAILABLE";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}
