export type ApiErrorCode =
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "SERVICE_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CREDENTIALS"
  | "INVITATION_INVALID"
  | "INVITATION_EXPIRED"
  | "INVITATION_ALREADY_USED"
  | "WORKSPACE_NOT_FOUND";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}
