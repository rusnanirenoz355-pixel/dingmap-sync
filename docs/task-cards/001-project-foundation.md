# 任务卡 001：项目第一版地基

## 任务目标

基于需求文档创建“钉图自动化同步工作台”的第一版地基。

## 范围

1. 创建 monorepo 项目结构。
2. 配置 pnpm、Next.js、TypeScript、Tailwind CSS、SQLite、Playwright、ExcelJS、Zod、Vitest、ESLint。
3. 创建数据库 schema、迁移和 seed。
4. 创建 DataSourcePlugin 接口和 manual_paste 占位插件。
5. 创建 Shared 类型、normalizer、dingmap、browser-controller 基础模块。
6. 创建 dashboard 占位页面。
7. 创建 .agent 规则包、docs、CI 和 README。

## 不做

1. 不做优招真实采集。
2. 不做捷聘真实采集。
3. 不做钉图真实登录。
4. 不做钉图真实录入。
5. 不做复杂自然语言解析。
6. 不做定时同步。
7. 不接入真实业务数据。

## 验收标准

1. pnpm install 成功。
2. pnpm db:migrate 可以创建数据库表。
3. pnpm check 通过。
4. pnpm lint 尽量通过。
5. pnpm test 有基础测试可通过。
6. docs/dev-log.md 已更新。
