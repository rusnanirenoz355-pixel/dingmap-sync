import { DINGMAP_COORDINATE_TYPE, getDingmapMarkerColorIndex } from "./dingmap-platforms";

export const DINGMAP_HOME_URL = "https://dm.dingmap.com/home";
export const DINGMAP_TARGET_MAP_URL =
  "https://dm.dingmap.com/home/map?id=c7b3a5c524864c698416c093843c34c6";
export const DINGMAP_TARGET_TEAM_NAME = "速宸立信 团队";
export const DINGMAP_TARGET_MAP_NAME = "面试点";
export const DINGMAP_TARGET_TEAM_TITLE = `我协作的地图 - ${DINGMAP_TARGET_TEAM_NAME}`;
export { DINGMAP_COORDINATE_TYPE };

export const dingmapSelectors = {
  loginIndicators: [
    "input[type='password']",
    "input[placeholder*='密码']",
    "input[placeholder*='账号']",
    "text=登录",
    "text=验证码",
  ],
  captchaIndicators: ["text=验证码", "text=人机验证", "text=安全验证", "iframe[src*='captcha']"],
  layerList: ["text=图层列表"],
  layerMoreButtons: [],
  dataImportMenuItems: [
    "text=数据导入",
    "[role='menuitem']:has-text('数据导入')",
    "button:has-text('数据导入')",
  ],
  dataImportDialog: [
    "text=数据导入",
    "[role='dialog']:has-text('数据导入')",
    ".ant-modal:has-text('数据导入')",
  ],
  addDataTabs: [
    "text=新增数据",
    "[role='tab']:has-text('新增数据')",
    "button:has-text('新增数据')",
  ],
  coordinateTypeIndicators: [
    "text=火星坐标（高德/腾讯/谷歌）",
    "text=火星坐标",
    "text=高德/腾讯/谷歌",
  ],
  coordinateTypeTriggers: [
    "[aria-label*='坐标类型']",
    "[title*='坐标类型']",
    "text=坐标类型",
    "[role='combobox']:has-text('坐标')",
  ],
  coordinateTypeOptions: [
    "text=火星坐标（高德/腾讯/谷歌）",
    "[role='option']:has-text('火星坐标')",
    "[role='menuitem']:has-text('火星坐标')",
  ],
  markerStyleTriggers: [
    "[aria-label*='标记样式']",
    "[title*='标记样式']",
    "text=标记样式",
  ],
  markerSizeOptions: [
    "text=小",
    "[role='radio']:has-text('小')",
    "[role='button']:has-text('小')",
  ],
  uploadZones: [
    "text=点击选择导入文件",
    "text=选择导入文件",
    "text=点击上传",
    "text=上传文件",
  ],
  fileInputs: [
    "input[type='file'][accept*='.xlsx']",
    "input[type='file'][accept*='excel']",
    "input[type='file']",
  ],
  confirmButtons: [
    "xpath=(//*[@role='dialog']//button[normalize-space(.)='导入' and not(@disabled)])[last()]",
    "xpath=(//*[contains(@class, 'modal') or contains(@class, 'dialog')]//button[normalize-space(.)='导入' and not(@disabled)])[last()]",
    "xpath=(//button[normalize-space(.)='导入' and not(@disabled)])[last()]",
    "button:has-text('导入')",
    "button:has-text('确认导入')",
    "button:has-text('开始导入')",
  ],
  successIndicators: ["text=导入成功", "text=上传成功", "text=成功导入", "text=完成"],
  failureIndicators: ["text=导入失败", "text=上传失败", "text=格式错误", "text=校验失败", "text=失败"],
} as const;

export function buildLayerMoreButtonSelectors(layerName: string): string[] {
  const layerText = toXPathString(layerName);
  const moreButtonPredicate =
    "contains(normalize-space(.), '更多') or contains(@aria-label, '更多') or contains(@title, '更多')";
  return [
    `xpath=(//*[contains(normalize-space(.), '图层列表')]/following::*[text()[contains(normalize-space(.), ${layerText})]][1]/ancestor::*[.//button[${moreButtonPredicate}]][1]//button[${moreButtonPredicate}])[1]`,
    `xpath=(//*[contains(normalize-space(.), '图层列表')]/following::*[text()[contains(normalize-space(.), ${layerText})]][1]/ancestor::*[.//*[@role='button' and (${moreButtonPredicate})]][1]//*[@role='button' and (${moreButtonPredicate})])[1]`,
    `xpath=(//*[contains(normalize-space(.), '图层列表')]/following::*[contains(normalize-space(.), ${layerText})][1]/ancestor::*[.//button[${moreButtonPredicate}] or .//*[@role='button' and (${moreButtonPredicate})]][1]//*[self::button or @role='button'][${moreButtonPredicate}])[1]`,
  ];
}

export function buildMarkerColorSelectors(colorLabel: string, color: Parameters<typeof getDingmapMarkerColorIndex>[0]): string[] {
  const colorIndex = getDingmapMarkerColorIndex(color);
  const oneBasedIndex = colorIndex + 1;
  return [
    `[aria-label*='${colorLabel}']`,
    `[title*='${colorLabel}']`,
    `[role='button']:has-text('${colorLabel}')`,
    `button:has-text('${colorLabel}')`,
    // nth fallback based on the current DingMap color swatch order:
    // blue, green, red, purple, orange, yellow, black.
    `xpath=(//*[@role='dialog']//*[@role='button' or self::button][not(contains(normalize-space(.), '小'))])[${oneBasedIndex}]`,
  ];
}

function toXPathString(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }

  if (!value.includes('"')) {
    return `"${value}"`;
  }

  return `concat(${value
    .split("'")
    .map((part) => `'${part}'`)
    .join(`, "'", `)})`;
}
