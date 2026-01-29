export interface GlobalOptions {
  verbose?: boolean;
  apiUrl?: string;
  apiKey?: string;
  json?: boolean;
  help?: boolean;
}

export interface Config {
  api_url?: string;
  api_key?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PingResponse {
  status: string;
  authenticated: string;
}
