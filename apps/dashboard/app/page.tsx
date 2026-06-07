import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Database,
  FileSpreadsheet,
  ListChecks,
  MapPinned,
  Play,
  RefreshCw,
  Settings,
  Table2,
  Upload,
  XCircle,
} from "lucide-react";

const navItems = ["数据源", "Raw 数据", "Clean 数据", "同步计划", "粘贴导入", "日志", "设置"];

const stats = [
  { label: "待新增", value: "0", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { label: "待更新", value: "0", tone: "border-blue-200 bg-blue-50 text-blue-700" },
  { label: "疑似下架", value: "0", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { label: "失败", value: "0", tone: "border-red-200 bg-red-50 text-red-700" },
  { label: "已同步", value: "0", tone: "border-slate-200 bg-white text-slate-800" },
];

const sources = [
  { name: "优招", type: "网页来源插件", status: "预留", icon: Database },
  { name: "捷聘", type: "网页来源插件", status: "预留", icon: Database },
  { name: "钉图", type: "目标地图", status: "导出优先", icon: MapPinned },
  { name: "手动粘贴", type: "manual_paste", status: "已占位", icon: ClipboardPaste },
  { name: "Excel 导入", type: "文件来源插件", status: "预留", icon: FileSpreadsheet },
];

const tables = [
  {
    title: "Raw Table",
    icon: Table2,
    columns: ["来源", "标题", "地址", "解析状态", "抓取时间"],
  },
  {
    title: "Clean Table",
    icon: CheckCircle2,
    columns: ["站点名称", "地址", "同步动作", "同步状态", "更新时间"],
  },
  {
    title: "Sync Plan",
    icon: ListChecks,
    columns: ["动作", "原因", "Before Hash", "After Hash", "状态"],
  },
  {
    title: "Sync Logs",
    icon: RefreshCw,
    columns: ["Run ID", "来源", "动作", "结果", "截图"],
  },
];

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-page text-textMain">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MapPinned aria-hidden="true" className="h-5 w-5 shrink-0" />
            <span className="truncate text-base font-semibold">DingMap Sync</span>
          </div>
          <nav className="hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex">
            {navItems.map((item) => (
              <button
                key={item}
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-textSubtle hover:bg-tableHead hover:text-textMain"
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
          <button
            className="ml-auto inline-flex h-10 items-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            type="button"
          >
            <Play aria-hidden="true" className="h-4 w-4" />
            <span>执行同步</span>
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
          {navItems.map((item) => (
            <button
              key={item}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-textSubtle hover:bg-tableHead hover:text-textMain"
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((stat) => (
            <article
              key={stat.label}
              className={`rounded-card border p-4 shadow-sm ${stat.tone}`}
            >
              <p className="text-sm font-medium">{stat.label}</p>
              <p className="mt-3 text-3xl font-semibold leading-none">{stat.value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sources.map((source) => {
              const Icon = source.icon;
              return (
                <article
                  key={source.name}
                  className="rounded-card border border-line bg-panel p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-tableHead">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{source.name}</h2>
                        <p className="mt-1 truncate text-sm text-textSubtle">{source.type}</p>
                      </div>
                    </div>
                    <span className="whitespace-nowrap rounded-md border border-line px-2 py-1 text-xs text-textSubtle">
                      {source.status}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="rounded-card border border-line bg-panel p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">粘贴导入</h2>
                <p className="mt-1 text-sm text-textSubtle">manual_paste</p>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-3 text-sm font-medium text-white hover:bg-zinc-800"
                type="button"
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                <span>导入 Clean Table</span>
              </button>
            </div>
            <textarea
              className="mt-4 h-32 w-full resize-none rounded-md border border-line bg-white p-3 text-sm outline-none ring-0 placeholder:text-textWeak focus:border-zinc-400"
              placeholder="粘贴站点名称、地址、电话、薪资、福利等文本"
            />
            <div className="mt-3 rounded-md border border-dashed border-line bg-tableHead p-3 text-sm text-textSubtle">
              识别预览占位
            </div>
          </section>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {tables.map((table) => {
            const Icon = table.icon;
            return (
              <section
                key={table.title}
                className="overflow-hidden rounded-card border border-line bg-panel shadow-sm"
              >
                <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  <h2 className="text-base font-semibold">{table.title}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                    <thead className="bg-tableHead text-textSubtle">
                      <tr>
                        {table.columns.map((column) => (
                          <th key={column} className="px-4 py-3 font-medium">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-5 text-textWeak" colSpan={table.columns.length}>
                          暂无数据
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <StatusPill icon={CheckCircle2} label="成功" className="text-emerald-700" />
          <StatusPill icon={AlertTriangle} label="待确认" className="text-amber-700" />
          <StatusPill icon={XCircle} label="失败" className="text-red-700" />
        </section>
      </div>
    </main>
  );
}

function StatusPill({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof CheckCircle2;
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-card border border-line bg-panel px-4 py-3 text-sm shadow-sm">
      <Icon aria-hidden="true" className={`h-4 w-4 ${className}`} />
      <span className="font-medium">{label}</span>
      <Settings aria-hidden="true" className="ml-auto h-4 w-4 text-textWeak" />
    </div>
  );
}
