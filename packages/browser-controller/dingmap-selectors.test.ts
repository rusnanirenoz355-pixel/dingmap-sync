import { describe, expect, it } from "vitest";
import {
  DINGMAP_HOME_URL,
  DINGMAP_TARGET_MAP_NAME,
  DINGMAP_TARGET_TEAM_NAME,
  DINGMAP_TARGET_TEAM_TITLE,
  buildLayerMoreButtonSelectors,
  buildMarkerColorSelectors,
  dingmapSelectors,
} from "./dingmap-selectors";

describe("dingmap upload selectors", () => {
  it("pins the upload target to the expected team and map", () => {
    expect(DINGMAP_HOME_URL).toBe("https://dm.dingmap.com/home");
    expect(DINGMAP_TARGET_TEAM_NAME).toBe("速宸立信 团队");
    expect(DINGMAP_TARGET_MAP_NAME).toBe("面试点");
    expect(DINGMAP_TARGET_TEAM_TITLE).toBe("我协作的地图 - 速宸立信 团队");
  });

  it("uses the map-internal data import flow instead of a list-page import shortcut", () => {
    expect(dingmapSelectors.layerList).toContain("text=图层列表");
    expect(dingmapSelectors.dataImportMenuItems).toContain("text=数据导入");
    expect(dingmapSelectors.addDataTabs).toContain("text=新增数据");
    expect(dingmapSelectors.uploadZones).toContain("text=点击选择导入文件");
    expect(dingmapSelectors.confirmButtons[0]).toContain("导入");
  });

  it("builds layer-specific more-menu selectors", () => {
    const selectors = buildLayerMoreButtonSelectors("美团点");

    expect(selectors[0]).toContain("图层列表");
    expect(selectors[0]).toContain("美团点");
    expect(selectors[0]).toContain("更多");
  });

  it("keeps marker color nth fallbacks centralized", () => {
    const selectors = buildMarkerColorSelectors("黄色", "yellow");

    expect(selectors).toContain("[aria-label*='黄色']");
    expect(selectors.at(-1)).toContain("[6]");
  });
});
