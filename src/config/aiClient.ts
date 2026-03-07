import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from "axios";

const aiClient = axios.create({
  baseURL: process.env.FASTAPI_URL ?? "http://127.0.0.1:8000",
  timeout: 60_000,
});

aiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  console.log(`[AI] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

aiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    const data = err.response?.data as Record<string, unknown> | undefined;
    console.error(`[AI] Error ${status}:`, data ?? err.message);
    return Promise.reject(err);
  }
);

export default aiClient;
