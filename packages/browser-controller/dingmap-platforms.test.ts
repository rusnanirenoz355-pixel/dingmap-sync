import { describe, expect, it } from "vitest";

import {
  DINGMAP_COORDINATE_TYPE,
  DINGMAP_PLATFORM_OPTIONS,
  resolveDingmapPlatform,
} from "./dingmap-platforms";

describe("dingmap platform upload configuration", () => {
  it("keeps platform options in the expected Dashboard order", () => {
    expect(DINGMAP_PLATFORM_OPTIONS.map((platform) => platform.key)).toEqual([
      "other",
      "shangchao",
      "taobao",
      "meituan",
      "maicai",
      "mianshi",
    ]);
  });

  it("maps each platform to the target layer and marker color", () => {
    expect(resolveDingmapPlatform("other")).toMatchObject({
      label: "其他点",
      layerName: "其他点",
      markerColor: "orange",
      markerColorLabel: "橙色",
      markerSize: "小",
    });
    expect(resolveDingmapPlatform("shangchao").markerColorLabel).toBe("紫色");
    expect(resolveDingmapPlatform("taobao").markerColorLabel).toBe("蓝色");
    expect(resolveDingmapPlatform("meituan").markerColorLabel).toBe("黄色");
    expect(resolveDingmapPlatform("maicai").markerColorLabel).toBe("绿色");
    expect(resolveDingmapPlatform("mianshi").markerColorLabel).toBe("红色");
  });

  it("defaults missing platform to mianshi and rejects unknown keys", () => {
    expect(resolveDingmapPlatform(undefined).key).toBe("mianshi");
    expect(() => resolveDingmapPlatform("unknown")).toThrow("平台");
  });

  it("keeps coordinate type fixed to mars coordinates", () => {
    expect(DINGMAP_COORDINATE_TYPE).toBe("火星坐标（高德/腾讯/谷歌）");
  });
});
