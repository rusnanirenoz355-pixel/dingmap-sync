export type DingmapPlatformKey =
  | "other"
  | "shangchao"
  | "taobao"
  | "meituan"
  | "maicai"
  | "mianshi";

export type DingmapMarkerColor =
  | "blue"
  | "green"
  | "red"
  | "purple"
  | "orange"
  | "yellow"
  | "black";

export interface DingmapPlatformConfig {
  key: DingmapPlatformKey;
  label: string;
  layerName: string;
  markerColor: DingmapMarkerColor;
  markerColorLabel: string;
  markerSize: "小";
}

export const DINGMAP_COORDINATE_TYPE = "火星坐标（高德/腾讯/谷歌）";
export const DINGMAP_MARKER_SIZE = "小";

// Current DingMap import dialog shows marker color swatches in this order.
// Keep nth/index-based fallbacks centralized here so future UI changes only
// require updating this config, not the automation flow.
export const DINGMAP_MARKER_COLOR_ORDER: readonly DingmapMarkerColor[] = [
  "blue",
  "green",
  "red",
  "purple",
  "orange",
  "yellow",
  "black",
] as const;

export const DINGMAP_PLATFORMS: Record<DingmapPlatformKey, DingmapPlatformConfig> = {
  other: {
    key: "other",
    label: "其他点",
    layerName: "其他点",
    markerColor: "orange",
    markerColorLabel: "橙色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
  shangchao: {
    key: "shangchao",
    label: "商超点",
    layerName: "商超点",
    markerColor: "purple",
    markerColorLabel: "紫色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
  taobao: {
    key: "taobao",
    label: "淘宝点",
    layerName: "淘宝点",
    markerColor: "blue",
    markerColorLabel: "蓝色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
  meituan: {
    key: "meituan",
    label: "美团点",
    layerName: "美团点",
    markerColor: "yellow",
    markerColorLabel: "黄色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
  maicai: {
    key: "maicai",
    label: "买菜点",
    layerName: "买菜点",
    markerColor: "green",
    markerColorLabel: "绿色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
  mianshi: {
    key: "mianshi",
    label: "面试点",
    layerName: "面试点",
    markerColor: "red",
    markerColorLabel: "红色",
    markerSize: DINGMAP_MARKER_SIZE,
  },
};

export const DINGMAP_DEFAULT_PLATFORM_KEY: DingmapPlatformKey = "mianshi";

export const DINGMAP_PLATFORM_OPTIONS: readonly DingmapPlatformConfig[] = [
  DINGMAP_PLATFORMS.other,
  DINGMAP_PLATFORMS.shangchao,
  DINGMAP_PLATFORMS.taobao,
  DINGMAP_PLATFORMS.meituan,
  DINGMAP_PLATFORMS.maicai,
  DINGMAP_PLATFORMS.mianshi,
] as const;

export function resolveDingmapPlatform(platform?: unknown): DingmapPlatformConfig {
  const key =
    typeof platform === "string" && platform.trim()
      ? platform.trim()
      : DINGMAP_DEFAULT_PLATFORM_KEY;

  if (isDingmapPlatformKey(key)) {
    return DINGMAP_PLATFORMS[key];
  }

  throw new Error(`钉图上传平台无效：${String(platform)}`);
}

export function isDingmapPlatformKey(value: unknown): value is DingmapPlatformKey {
  return typeof value === "string" && Object.hasOwn(DINGMAP_PLATFORMS, value);
}

export function getDingmapMarkerColorIndex(color: DingmapMarkerColor): number {
  return DINGMAP_MARKER_COLOR_ORDER.indexOf(color);
}
