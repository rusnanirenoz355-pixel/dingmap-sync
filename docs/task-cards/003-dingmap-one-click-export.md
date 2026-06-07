# 任务卡 003：钉图一键录入模板导出

## 任务目标

实现 Clean Table 到钉图一键录入模板 / 数据包的导出。

## 范围

1. 梳理钉图一键录入模板字段。
2. 完善 packages/dingmap/one-click-export.ts。
3. 生成包含【系统同步信息】和【人工备注】的描述文本。
4. Dashboard 增加导出入口。
5. 写入 sync_plan 和 sync_logs。

## 不做

1. 不做 Playwright 逐条录入。
2. 不做钉图真实登录。
3. 不提交真实业务数据。

## 验收标准

1. 可从 Clean Table 导出 Excel 模板。
2. 描述字段格式稳定。
3. 导出文件写入 data/exports 或用户指定目录。
