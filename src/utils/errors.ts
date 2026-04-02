import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export function invalidParams(message: string): McpError {
  return new McpError(ErrorCode.InvalidParams, message);
}

export function internalError(message: string): McpError {
  return new McpError(ErrorCode.InternalError, message);
}

export function steamApiError(status: number, endpoint: string): McpError {
  if (status === 401 || status === 403) {
    return new McpError(
      ErrorCode.InvalidParams,
      `Steam API returned ${status} for ${endpoint}. The profile may be private or the API key is invalid.`
    );
  }
  return new McpError(
    ErrorCode.InternalError,
    `Steam API error ${status} for ${endpoint}`
  );
}
