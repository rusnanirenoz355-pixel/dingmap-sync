# 项目简报

## 项目目标

钉图自动化同步工作台用于把优招、捷聘、后续网页来源、手动粘贴、Excel 等多来源数据统一进入 Raw Table，再清洗成 Clean Table，最后导出为钉图可一键录入的数据包或模板。

## 核心流程

1. 数据源插件采集或导入原始信息。
2. 原始信息写入 Raw Table。
3. normalizer 清洗并生成 Clean Table。
4. Clean Table 生成同步计划。
5. 第一优先级导出钉图一键录入模板。
6. 同步过程写入 sync_runs、sync_plan、sync_logs。

## 第一优先级：钉图一键录入

优先做 Clean Table 到钉图一键录入模板 / 数据包导出，不优先做浏览器逐条录入。

## 备用方案

Playwright 逐条录入钉图作为备用方案，相关入口保留在 browser-controller 和 dingmap 包内。

## 多来源插件化

所有来源必须通过 DataSourcePlugin 接入，不允许把优招、捷聘写死进主流程。

## 粘贴导入

manual_paste 是第一版就存在的数据源插件，当前只做类型与占位预览，后续任务实现模板字段识别并导入 Clean Table。

## 跨电脑开发

项目必须能通过 Git、pnpm、.env.example 和迁移脚本在公司电脑与家里电脑之间继续开发。
