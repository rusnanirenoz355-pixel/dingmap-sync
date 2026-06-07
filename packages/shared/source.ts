export type SourceType = "web" | "manual_paste" | "excel" | "dingmap";

export interface DataSourceDefinition {
  sourceKey: string;
  sourceName: string;
  sourceType: SourceType;
  startUrl: string;
  loginRequired: boolean;
  strategy: "browser" | "manual" | "file" | "export";
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface DataSourcePlugin<TRaw = unknown, TNormalized = unknown> {
  sourceKey: string;
  sourceName: string;
  startUrl: string;
  loginRequired: boolean;
  loginCheck(context?: unknown): Promise<boolean>;
  collect(context?: unknown): Promise<TRaw[]>;
  normalize(records: TRaw[]): Promise<TNormalized[]>;
}
