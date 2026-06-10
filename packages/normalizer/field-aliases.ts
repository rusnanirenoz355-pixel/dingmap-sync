export const fieldAliases = {
  site_name: ["站点名称", "面试点", "门店", "站点", "名称", "标题"],
  address: ["地址", "详细地址", "面试地址", "站点地址", "定位"],
  phone: ["电话", "手机号", "联系方式", "联系电话", "手机"],
  salary: ["薪资", "薪资待遇", "待遇", "工资", "收入"],
  welfare: ["福利", "福利待遇", "补贴", "优势", "亮点"],
  station_manager: ["站长", "联系人", "负责人", "经理", "主管"],
  interview_time: ["面试时间", "到场时间", "上班时间"],
  job_title: ["岗位", "职位", "招聘岗位"],
  remark: ["备注", "说明", "其他", "补充", "\u4ea4\u4ed8\u6761\u4ef6"],
} as const;

export type NormalizedFieldName = keyof typeof fieldAliases;

function compactHeader(value: string): string {
  return value.trim().replace(/\s+/g, "").replace(/[：:]/g, "").toLowerCase();
}

const aliasLookup = new Map<string, NormalizedFieldName>(
  Object.entries(fieldAliases).flatMap(([field, aliases]) => {
    const normalizedField = field as NormalizedFieldName;
    return [field, ...aliases].map((alias) => [compactHeader(alias), normalizedField]);
  }),
);

export function resolveFieldAlias(header: string): NormalizedFieldName | undefined {
  return aliasLookup.get(compactHeader(header));
}
