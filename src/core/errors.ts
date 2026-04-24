export class RaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaxError";
  }
}

export class ValidationFailureError extends RaxError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationFailureError";
  }
}
