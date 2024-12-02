class ApiError extends Error {
    statusCode: number;
    data: any = null;
    success: boolean;
    errors: string[];
    stack?: string;

    constructor(
        statusCode: number,
        message = "Something went wrong",
        errors: string[] = [],
        stack = ""
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }

        // Ensure instanceof works reliably
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export { ApiError };
