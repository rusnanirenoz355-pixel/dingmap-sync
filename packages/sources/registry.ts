import { manualPastePlugin } from "./manual-paste/plugin";
import type { DataSourcePlugin } from "./types";

const registry = new Map<string, DataSourcePlugin>();

export function registerSourcePlugin(plugin: DataSourcePlugin): void {
  registry.set(plugin.sourceKey, plugin);
}

export function getSourcePlugin(sourceKey: string): DataSourcePlugin | undefined {
  return registry.get(sourceKey);
}

export function listSourcePlugins(): DataSourcePlugin[] {
  return Array.from(registry.values());
}

export function registerDefaultSourcePlugins(): void {
  registerSourcePlugin(manualPastePlugin);
}

registerDefaultSourcePlugins();
