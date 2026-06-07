# [Task 002] 粘贴模板导入 Clean Table

Labels: `task`, `feature`, `manual-paste`, `clean-table`, `priority-high`

## 背景

任务 001 已完成项目地基。下一步先做不依赖外部网站的核心功能：粘贴模板导入 Clean Table。

## 目标

支持用户从 Excel、飞书、微信表格等复制站点信息，粘贴到工作台后自动识别字段、预览、校验并导入 clean_markers。

## 范围

* TSV / 表格文本解析
* 表头识别
* 字段别名映射
* 预览结果
* 手机号校验
* 必填字段校验
* 去重判断
* 写入 clean_markers
* Dashboard 显示导入结果
* 支持导出 Clean Table Excel，占位或基础实现

## 不做范围

* 不做优招真实采集
* 不做捷聘真实采集
* 不做钉图真实录入
* 不做自然语言复杂解析
* 不接入真实业务数据

## 验收标准

* 可以粘贴包含表头的表格文本。
* 可以识别站点名称、地址、联系人、电话、薪资、福利、备注。
* 可以生成预览列表。
* 可以识别手机号格式异常。
* 可以识别缺少站点名或地址的数据。
* 可以导入 clean_markers。
* Clean Table 页面能看到导入结果。
* pnpm check 通过。
* pnpm lint 通过。
* pnpm test 通过。
* pnpm verify 通过。

## 命令验证清单

* [ ] corepack pnpm install
* [ ] corepack pnpm db:migrate
* [ ] corepack pnpm check
* [ ] corepack pnpm lint
* [ ] corepack pnpm test
* [ ] corepack pnpm verify
* [ ] corepack pnpm dev

## 关联文档

* docs/dev-log.md
* docs/task-cards/002-manual-paste-import.md
* .agent/coding-rules.md
* .agent/github-issues-rules.md

## 跨设备继续开发说明

另一台电脑继续开发前：

1. git pull
2. corepack pnpm install
3. cp .env.example .env
4. corepack pnpm run setup
5. corepack pnpm dev
6. 查看本 Issue 和 docs/dev-log.md
