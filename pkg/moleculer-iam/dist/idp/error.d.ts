import { OIDCError } from "../op";
import { ValidationError as ValidationErrorEntry } from "../helper/validator";
declare class IdentityProviderError implements OIDCError {
    readonly status: number;
    readonly error: string;
    readonly error_description: string | undefined;
    constructor(status: number, error: string, error_description: string | undefined);
}
declare class IdentityAlreadyExistsError extends IdentityProviderError {
    constructor();
}
declare class IdentityNotExistsError extends IdentityProviderError {
    constructor();
}
declare class InvalidCredentialsError extends IdentityProviderError {
    constructor();
}
declare class UnsupportedCredentialsError extends IdentityProviderError {
    constructor();
}
declare class ValidationError extends IdentityProviderError {
    readonly data: ValidationErrorEntry[];
    readonly debug?: object | undefined;
    constructor(data: ValidationErrorEntry[], debug?: object | undefined);
}
export declare const IAMErrors: {
    IdentityProviderError: typeof IdentityProviderError;
    IdentityAlreadyExistsError: typeof IdentityAlreadyExistsError;
    IdentityNotExistsError: typeof IdentityNotExistsError;
    InvalidCredentialsError: typeof InvalidCredentialsError;
    UnsupportedCredentialsError: typeof UnsupportedCredentialsError;
    ValidationError: typeof ValidationError;
};
export {};
