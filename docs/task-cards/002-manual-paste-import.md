# 任务卡 002：粘贴模板导入 Clean Table

## 任务目标

实现“粘贴模板信息 -> 字段识别预览 -> 导入 Clean Table”的第一版闭环。

## 范围

1. 扩展 manual_paste parser，支持字段别名识别。
2. 生成 ImportPreviewRow。
3. 校验必填字段。
4. 将确认后的记录写入 raw_records 和 clean_markers。
5. Dashboard 增加粘贴导入交互和预览表格。

## 不做

1. 不做复杂自然语言理解。
2. 不接入真实手机号和真实地址样本。
3. 不自动同步到钉图。

## 验收标准

1. 可粘贴样例文本并生成预览。
2. 可把确认后的预览写入 Clean Table。
3. 导入过程有日志。
