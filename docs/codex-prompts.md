# 常用 Codex 提示词

## 继续项目

请先阅读 README.md、docs/dev-log.md 和 .agent/*.md，再继续当前任务。默认不接入真实业务数据，不提交 .env、.auth、data/*.db。

## 新增数据源

请把新来源作为 DataSourcePlugin 插件接入，不要写死到主流程。数据必须先进入 Raw Table，再清洗进入 Clean Table。

## 粘贴导入

请实现 manual_paste 的字段识别、预览、校验和导入 Clean Table。第一版优先保证可回滚、可校验、可记录导入日志。

## 钉图导出

请实现 Clean Table 到钉图一键录入模板的导出。Playwright 逐条录入只作为备用方案。
