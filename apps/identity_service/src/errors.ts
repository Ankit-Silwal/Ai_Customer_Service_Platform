export class AppError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const forbidden = (message = "You do not have permission to perform this action") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (resource: string) => new AppError(404, "NOT_FOUND", `${resource} was not found`);
export const unauthorized = (message = "Authentication is required") =>
  new AppError(401, "UNAUTHORIZED", message);
